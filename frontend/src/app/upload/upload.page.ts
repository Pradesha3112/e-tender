import { AppShellComponent } from '../shared/shell/shell.component';

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule, AppShellComponent],
})
export class UploadPage implements OnInit {

  // ----- Image -----
  selectedImage: string | undefined = undefined;
  selectedFile: File | undefined = undefined;

  // ----- PDF -----
  isPdf = false;
  selectedPdfName = '';
  selectedPdfBase64 = '';   // raw base64, no data: prefix

  // ----- Compression info -----
  originalSizeKb = 0;
  compressedSizeKb = 0;
  isCompressing = false;

  // ----- Category -----
  categories: string[] = [];
  selectedCategory: string = '';
  categoryLabel: string = '';
  allowAllCategories: boolean = false;

  // ----- State -----
  isLoading = false;
  isLoadingCategories = true;
  errorMessage = '';

  // ----- Limits -----
  private readonly MAX_DIMENSION = 1600;     // image longest-side px
  private readonly JPEG_QUALITY = 0.75;      // image quality
  private readonly MAX_IMAGE_INPUT_MB = 25;  // image input guard
  private readonly MAX_PDF_MB = 5;           // PDF must be <= 5 MB

  constructor(
    private router: Router,
    private apiService: ApiService,
    public auth: AuthService,
  ) {
    console.log('✅ UPLOAD PAGE LOADED!');
  }

  ngOnInit() {
    this.loadCategories();
  }

  // ============================================================
  // LOAD CATEGORIES
  // ============================================================
  loadCategories() {
    this.isLoadingCategories = true;

    this.apiService.getCategories().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          const data = res.data || {};
          this.categories = data.categories || [];
          this.categoryLabel = data.label || '';
          this.allowAllCategories = !!data.allow_all;

          if (this.categories.length > 0) {
            this.selectedCategory = this.categories[0];
          }
        }
        this.isLoadingCategories = false;
      },
      error: (err) => {
        console.error('❌ Failed to load categories:', err);
        this.isLoadingCategories = false;
        this.errorMessage = 'Could not load categories. Please refresh.';
      },
    });
  }

  // ============================================================
  // CAMERA / GALLERY  (images only)
  // ============================================================
  async openCamera() {
    console.log('📸 Opening camera...');
    this.errorMessage = '';
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      this.resetPdfState();
      await this.applyCompression(image.dataUrl!);
    } catch (error: any) {
      console.error('Camera error:', error);
      this.errorMessage = 'Camera error: ' + (error.message || 'Unknown error');
    }
  }

  async openGallery() {
    console.log('🖼️ Opening gallery...');
    this.errorMessage = '';
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });
      this.resetPdfState();
      await this.applyCompression(image.dataUrl!);
    } catch (error: any) {
      console.error('Gallery error:', error);
      this.errorMessage = 'Gallery error: ' + (error.message || 'Unknown error');
    }
  }

  // ============================================================
  // FILE INPUT — handles BOTH images and PDFs
  // ============================================================
  async onFileSelected(event: any) {
    console.log('📁 File selected');
    this.errorMessage = '';

    const file: File = event.target.files[0];
    if (!file) return;

    const isPdfFile =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf');

    // ---------------- PDF branch ----------------
    if (isPdfFile) {
      const sizeMb = file.size / (1024 * 1024);

      if (sizeMb > this.MAX_PDF_MB) {
        this.errorMessage =
          `PDF too large (${sizeMb.toFixed(2)} MB). Max allowed: ${this.MAX_PDF_MB} MB. ` +
          `Please compress the PDF first.`;
        event.target.value = '';
        return;
      }

      this.selectedFile = file;
      this.isPdf = true;
      this.selectedImage = undefined;
      this.selectedPdfName = file.name;

      const reader = new FileReader();
      reader.onload = (e: any) => {
        const dataUrl: string = e.target.result;
        const base64 = dataUrl.split(',')[1] || '';
        this.selectedPdfBase64 = base64;

        // approximate KB size from base64
        this.originalSizeKb = Math.round((base64.length * 3) / 4 / 1024);
        this.compressedSizeKb = this.originalSizeKb;

        console.log(`📄 PDF loaded: ${this.selectedPdfName} (${this.compressedSizeKb} KB)`);
      };
      reader.onerror = () => {
        this.errorMessage = 'Error reading PDF file';
      };
      reader.readAsDataURL(file);

      return;
    }

    // ---------------- Image branch ----------------
    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > this.MAX_IMAGE_INPUT_MB) {
      this.errorMessage =
        `File too large (${sizeMb.toFixed(1)} MB). Max allowed: ${this.MAX_IMAGE_INPUT_MB} MB.`;
      event.target.value = '';
      return;
    }

    this.resetPdfState();
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      await this.applyCompression(e.target.result);
    };
    reader.onerror = () => {
      this.errorMessage = 'Error reading file';
    };
    reader.readAsDataURL(file);
  }

  // ============================================================
  // HELPERS
  // ============================================================
  private resetPdfState() {
    this.isPdf = false;
    this.selectedPdfBase64 = '';
    this.selectedPdfName = '';
  }

  // ============================================================
  // IMAGE COMPRESSION
  // ============================================================
  private async applyCompression(dataUrl: string): Promise<void> {
    this.isCompressing = true;
    this.originalSizeKb = this.dataUrlSizeKb(dataUrl);

    try {
      const compressed = await this.compressImage(
        dataUrl,
        this.MAX_DIMENSION,
        this.JPEG_QUALITY
      );

      this.selectedImage = compressed;
      this.compressedSizeKb = this.dataUrlSizeKb(compressed);

      console.log(
        `🗜️ Compressed: ${this.originalSizeKb} KB → ${this.compressedSizeKb} KB ` +
        `(${Math.round((1 - this.compressedSizeKb / this.originalSizeKb) * 100)}% saved)`
      );
    } catch (err) {
      console.error('Compression failed, using original:', err);
      this.selectedImage = dataUrl;
      this.compressedSizeKb = this.originalSizeKb;
    } finally {
      this.isCompressing = false;
    }
  }

  private compressImage(
    dataUrl: string,
    maxDim: number,
    quality: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          let { width, height } = img;

          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height >= width && height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context not available');

          // White background (JPEG has no alpha)
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);

          ctx.drawImage(img, 0, 0, width, height);

          const out = canvas.toDataURL('image/jpeg', quality);
          resolve(out);
        } catch (e) {
          reject(e);
        }
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = dataUrl;
    });
  }

  /** Rough byte size of a base64 DataURL, in KB */
  private dataUrlSizeKb(dataUrl: string): number {
    if (!dataUrl) return 0;
    const base64 = dataUrl.split(',')[1] || '';
    const bytes = Math.floor((base64.length * 3) / 4);
    return Math.round(bytes / 1024);
  }

  // ============================================================
  // PROCESS BILL — sends either image OR pdf
  // ============================================================
  async processBill() {
    console.log('🔄 Processing bill...');
    this.errorMessage = '';

    // Validate
    if (this.isPdf) {
      if (!this.selectedPdfBase64) {
        this.errorMessage = 'Please select or upload a PDF first';
        return;
      }
    } else {
      if (!this.selectedImage) {
        this.errorMessage = 'Please select or upload a bill image first';
        return;
      }
    }

    if (!this.selectedCategory) {
      this.errorMessage = 'Please select a category first';
      return;
    }

    this.isLoading = true;

    try {
      // ✅ FIXED PAYLOAD: Flask expects 'image' key, and Python OCR needs the 'data:' prefix to detect PDFs
      const payload = this.isPdf
        ? { image: `data:application/pdf;base64,${this.selectedPdfBase64}` }
        : { image: this.selectedImage };

      const result = await this.apiService
        .uploadBillPayload(payload)
        .toPromise();

      if (result && result.success) {
        this.router.navigate(['/validation'], {
          state: {
            billData: result.data,
            category: this.selectedCategory,
          },
        });
      } else {
        throw new Error(result?.message || 'Unknown error');
      }
    } catch (error: any) {
      console.error('❌ Processing error:', error);
      this.errorMessage =
        error?.error?.error || error?.message || 'Error processing bill';
    } finally {
      this.isLoading = false;
    }
  }

  clearImage() {
    this.selectedImage = undefined;
    this.selectedFile = undefined;
    this.resetPdfState();
    this.errorMessage = '';
    this.originalSizeKb = 0;
    this.compressedSizeKb = 0;
  }

  goBack() {
    this.router.navigateByUrl('/dashboard');
  }
}
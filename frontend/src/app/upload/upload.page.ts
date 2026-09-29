// ============================================================
// FILE: src/app/upload/upload.page.ts
// PURPOSE: Upload bill + choose category (role-filtered)
// ============================================================

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
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class UploadPage implements OnInit {

  // Image
  selectedImage: string | undefined = undefined;
  selectedFile: File | undefined = undefined;

  // Category
  categories: string[] = [];
  selectedCategory: string = '';
  categoryLabel: string = '';
  allowAllCategories: boolean = false;

  // State
  isLoading = false;
  isLoadingCategories = true;
  errorMessage = '';

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
  // LOAD CATEGORIES (role-filtered by backend)
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

          // Auto-select first category (auto-categorization)
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
  // CAMERA / GALLERY / FILE
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
      this.selectedImage = image.dataUrl;
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
      this.selectedImage = image.dataUrl;
    } catch (error: any) {
      console.error('Gallery error:', error);
      this.errorMessage = 'Gallery error: ' + (error.message || 'Unknown error');
    }
  }

  onFileSelected(event: any) {
    console.log('📁 File selected');
    this.errorMessage = '';
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImage = e.target.result;
      };
      reader.onerror = () => {
        this.errorMessage = 'Error reading file';
      };
      reader.readAsDataURL(file);
    }
  }

  // ============================================================
  // PROCESS BILL
  // ============================================================
  async processBill() {
    console.log('🔄 Processing bill...');
    this.errorMessage = '';

    if (!this.selectedImage) {
      this.errorMessage = 'Please select or upload a bill image first';
      return;
    }

    if (!this.selectedCategory) {
      this.errorMessage = 'Please select a category first';
      return;
    }

    this.isLoading = true;

    try {
      const result = await this.apiService.uploadBill(this.selectedImage).toPromise();

      if (result && result.success) {
        // Pass extracted data + chosen category to validation page
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
      this.errorMessage = error?.error?.error
        || error?.message
        || 'Error processing bill';
    } finally {
      this.isLoading = false;
    }
  }

  clearImage() {
    this.selectedImage = undefined;
    this.selectedFile = undefined;
    this.errorMessage = '';
  }

  goBack() {
    this.router.navigateByUrl('/dashboard');
  }
}
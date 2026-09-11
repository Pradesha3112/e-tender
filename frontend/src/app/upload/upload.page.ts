import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-upload',
  templateUrl: './upload.page.html',
  styleUrls: ['./upload.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class UploadPage {
  selectedImage: string | undefined = undefined;
  selectedFile: File | undefined = undefined;
  isLoading = false;
  errorMessage: string = '';

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {
    console.log('✅ UPLOAD PAGE LOADED!');
  }

  // Open Camera
  async openCamera() {
    console.log('📸 Opening camera...');
    this.errorMessage = '';
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera
      });
      
      this.selectedImage = image.dataUrl;
      console.log('✅ Camera photo captured!');
      
      alert('📸 Photo captured! Click "Extract Bill Data" to read the bill.');
      
    } catch (error: any) {
      console.error('Camera error:', error);
      this.errorMessage = 'Camera error: ' + (error.message || 'Unknown error');
      alert(this.errorMessage);
    }
  }

  // Open Gallery
  async openGallery() {
    console.log('🖼️ Opening gallery...');
    this.errorMessage = '';
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos
      });
      
      this.selectedImage = image.dataUrl;
      console.log('✅ Gallery photo selected!');
      
      alert('🖼️ Photo selected! Click "Extract Bill Data" to read the bill.');
      
    } catch (error: any) {
      console.error('Gallery error:', error);
      this.errorMessage = 'Gallery error: ' + (error.message || 'Unknown error');
      alert(this.errorMessage);
    }
  }

  // Handle file upload from computer
  onFileSelected(event: any) {
    console.log('📁 File selected from computer');
    this.errorMessage = '';
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedImage = e.target.result;
        console.log('✅ File loaded!');
        alert('📁 File uploaded! Click "Extract Bill Data" to read the bill.');
      };
      reader.onerror = (error) => {
        console.error('File read error:', error);
        this.errorMessage = 'Error reading file';
      };
      reader.readAsDataURL(file);
    }
  }

  // Process the bill - Call backend API
  async processBill() {
    console.log('🔄 Processing bill...');
    this.errorMessage = '';
    
    if (!this.selectedImage) {
      alert('Please select or upload a bill image first!');
      return;
    }

    this.isLoading = true;

    try {
      console.log('📤 Sending image to backend...');
      
      // Call the backend API
      const result = await this.apiService.uploadBill(this.selectedImage).toPromise();
      
      console.log('✅ Backend response:', result);
      
      if (result && result.success) {
        // Navigate to validation page with extracted data
        this.router.navigate(['/validation'], {
          state: { billData: result.data }
        });
      } else {
        throw new Error(result?.message || 'Unknown error');
      }
      
    } catch (error: any) {
      console.error('❌ Processing error:', error);
      this.errorMessage = error.message || 'Error processing bill';
      alert('Error: ' + this.errorMessage + '\n\nMake sure Flask backend is running!');
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
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-validation',
  templateUrl: './validation.page.html',
  styleUrls: ['./validation.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class ValidationPage implements OnInit {
  billData: any = {};
  isEditing = false;
  editData: any = {};
  isSaving = false;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController
  ) {
    console.log('✅ VALIDATION PAGE LOADED!');
    
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.billData = navigation.extras.state['billData'];
      this.editData = { ...this.billData };
      console.log('📋 Bill data received:', this.billData);
    } else {
      // Fallback data if none passed
      this.billData = {
        bill_number: 'Not found',
        vendor: 'Not found',
        date: 'Not found',
        subtotal: 0,
        tax: 0,
        total: 0,
        gstin: 'Not found',
        items: [],
        amount_words: 'Not found'
      };
      this.editData = { ...this.billData };
    }
  }

  ngOnInit() {}

  async confirmBill() {
    console.log('💾 Saving bill...', this.billData);
    this.isSaving = true;
    
    try {
      this.apiService.saveBill(this.billData).subscribe({
        next: (response: any) => {
          console.log('✅ Bill saved:', response);
          this.isSaving = false;
          this.showSuccessAlert('✅ Bill Saved!', 'Your bill has been stored successfully!');
        },
        error: (error) => {
          console.error('❌ Save error:', error);
          this.isSaving = false;
          this.showAlert('Error', 'Failed to save bill. Please try again.');
        }
      });
    } catch (error) {
      console.error('❌ Error:', error);
      this.isSaving = false;
      this.showAlert('Error', 'Something went wrong. Please try again.');
    }
  }

  retakePhoto() {
    console.log('📸 Retaking photo...');
    this.router.navigateByUrl('/upload');
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editData = { ...this.billData };
      console.log('✏️ Edit mode enabled');
    }
  }

  saveEdits() {
    this.billData = { ...this.editData };
    this.isEditing = false;
    console.log('✅ Data updated:', this.billData);
    this.showAlert('Success', 'Data updated successfully!');
  }

  async showSuccessAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: [
        {
          text: 'View Bills',
          handler: () => {
            this.router.navigateByUrl('/bills');
          }
        },
        {
          text: 'Scan Another',
          handler: () => {
            this.router.navigateByUrl('/upload');
          }
        }
      ]
    });
    await alert.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
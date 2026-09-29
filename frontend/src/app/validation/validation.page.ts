// ============================================================
// FILE: src/app/validation/validation.page.ts
// PURPOSE: Review bill + category before saving
// ============================================================

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
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class ValidationPage implements OnInit {

  billData: any = {};
  editData: any = {};
  isEditing = false;
  isSaving = false;

  // Category — comes from upload page OR user changes here
  selectedCategory = '';
  categories: string[] = [];
  allowAllCategories = false;
  isLoadingCategories = true;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController,
  ) {
    console.log('✅ VALIDATION PAGE LOADED!');

    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.billData = nav.extras.state['billData'] || {};
      this.selectedCategory = nav.extras.state['category'] || '';
      this.editData = { ...this.billData };
    } else {
      // Fallback (should not happen)
      this.billData = {
        bill_number: '', vendor: '', date: '',
        subtotal: 0, tax: 0, total: 0,
        gstin: '', items: [], amount_words: '',
      };
      this.editData = { ...this.billData };
    }
  }

  ngOnInit() {
    this.loadCategories();
  }

  // ============================================================
  // LOAD CATEGORIES (for editing on this page)
  // ============================================================
  loadCategories() {
    this.isLoadingCategories = true;

    this.apiService.getCategories().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.categories = res.data?.categories || [];
          this.allowAllCategories = !!res.data?.allow_all;

          // If nothing was passed from upload page, auto-select first
          if (!this.selectedCategory && this.categories.length > 0) {
            this.selectedCategory = this.categories[0];
          }
        }
        this.isLoadingCategories = false;
      },
      error: () => {
        this.isLoadingCategories = false;
      },
    });
  }

  // ============================================================
  // SAVE
  // ============================================================
  confirmBill() {
    if (!this.selectedCategory) {
      this.showAlert('Missing Category', 'Please select a category first.');
      return;
    }

    const payload = {
      ...this.billData,
      category: this.selectedCategory,
    };

    console.log('💾 Saving bill:', payload);
    this.isSaving = true;

    this.apiService.saveBill(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.showSuccessAlert(
          '✅ Bill Saved!',
          `Saved as "${this.selectedCategory}"`
        );
      },
      error: (err) => {
        console.error('❌ Save error:', err);
        this.isSaving = false;
        this.showAlert(
          'Error',
          err?.error?.error || 'Failed to save bill. Please try again.'
        );
      },
    });
  }

  retakePhoto() {
    this.router.navigateByUrl('/upload');
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      this.editData = { ...this.billData };
    }
  }

  saveEdits() {
    this.billData = { ...this.editData };
    this.isEditing = false;
    this.showAlert('Success', 'Data updated successfully!');
  }

  // ============================================================
  // ALERTS
  // ============================================================
  async showSuccessAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: 'View Bills',
          handler: () => this.router.navigateByUrl('/bills'),
        },
        {
          text: 'Scan Another',
          handler: () => this.router.navigateByUrl('/upload'),
        },
      ],
    });
    await alert.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
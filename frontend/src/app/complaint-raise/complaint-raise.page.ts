// ============================================================
// FILE: src/app/complaint-raise/complaint-raise.page.ts
// PURPOSE: Public page — raise a complaint (no login required)
// ============================================================

import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  createComplaint,
  ComplaintPriority,
} from '../complaints/complaints.model';

@Component({
  selector: 'app-complaint-raise',
  templateUrl: './complaint-raise.page.html',
  styleUrls: ['./complaint-raise.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class ComplaintRaisePage {

  form = {
    subject: '',
    category: 'Hardware',
    priority: 'medium' as ComplaintPriority,
    description: '',
  };

  categories = COMPLAINT_CATEGORIES;
  priorities = COMPLAINT_PRIORITIES;

  isSubmitting = false;

  // Success state
  submitted = false;
  submittedId = '';

  constructor(
    private router: Router,
    private toastController: ToastController,
  ) {
    console.log('💬 Complaint Raise page loaded (public)');
  }

  // ============================================================
  // SUBMIT
  // ============================================================
  async submitComplaint(): Promise<void> {
    const subject     = (this.form.subject || '').trim();
    const description = (this.form.description || '').trim();

    if (subject.length < 3) {
      this.toast('Subject must be at least 3 characters', 'warning');
      return;
    }
    if (description.length < 10) {
      this.toast('Description must be at least 10 characters', 'warning');
      return;
    }

    this.isSubmitting = true;

    try {
      const complaint = createComplaint({
        subject,
        category: this.form.category,
        priority: this.form.priority,
        description,
        filedBy: 'guest',
        filedByRole: 'sso',
        filedByGroup: 'all',
      });

      this.submittedId = complaint.id;
      this.submitted = true;

      this.toast(`Complaint ${complaint.id} submitted successfully`, 'success');

    } catch (err) {
      console.error('❌ Submit error:', err);
      this.toast('Failed to submit complaint', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  // ============================================================
  // RAISE ANOTHER
  // ============================================================
  raiseAnother(): void {
    this.form = {
      subject: '',
      category: 'Hardware',
      priority: 'medium',
      description: '',
    };
    this.submitted = false;
    this.submittedId = '';
  }

  // ============================================================
  // BACK TO LOGIN
  // ============================================================
  goToLogin(): void {
    this.router.navigateByUrl('/login');
  }

  // ============================================================
  // TOAST
  // ============================================================
  async toast(message: string, color: string = 'primary'): Promise<void> {
    const t = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await t.present();
  }
}
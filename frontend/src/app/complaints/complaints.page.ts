// ============================================================
// FILE: src/app/complaints/complaints.page.ts
// PURPOSE: Raise complaint (form) + view own complaints (list)
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastController } from '@ionic/angular';
import { AppShellComponent } from '../shared/shell/shell.component';
import { AuthService } from '../services/auth.service';
import {
  Complaint,
  ComplaintPriority,
  COMPLAINT_CATEGORIES,
  COMPLAINT_PRIORITIES,
  createComplaint,
  getComplaintsByUser,
  getStatusColor,
  getStatusLabel,
  getStatusIcon,
  getPriorityColor,
  formatRelativeTime,
} from './complaints.model';

@Component({
  selector: 'app-complaints',
  templateUrl: './complaints.page.html',
  styleUrls: ['./complaints.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule,
    AppShellComponent,
  ],
})
export class ComplaintsPage implements OnInit {

  // ----- FORM STATE -----
  form = {
    subject: '',
    category: 'Hardware',
    priority: 'medium' as ComplaintPriority,
    description: '',
  };

  categories = COMPLAINT_CATEGORIES;
  priorities = COMPLAINT_PRIORITIES;

  isSubmitting = false;

  // ----- LIST STATE -----
  myComplaints: Complaint[] = [];
  showForm = true;

  constructor(
    private router: Router,
    public auth: AuthService,
    private toastController: ToastController,
  ) {
    console.log('💬 Complaints page loaded');
  }

  ngOnInit(): void {
    this.reloadList();
  }

  // ============================================================
  // TOGGLE FORM / LIST
  // ============================================================
  toggleForm(): void {
    this.showForm = !this.showForm;
    if (!this.showForm) {
      this.reloadList();
    }
  }

  // ============================================================
  // SUBMIT COMPLAINT
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
      const user = this.auth.getCurrentUser();

      const complaint = createComplaint({
        subject,
        category: this.form.category,
        priority: this.form.priority,
        description,
        filedBy: user?.username || 'guest',
        filedByRole: user?.role || 'guest',
        filedByGroup: user?.category_group || 'all',
      });

      this.toast(`Complaint ${complaint.id} submitted`, 'success');

      // Reset form
      this.form = {
        subject: '',
        category: 'Hardware',
        priority: 'medium',
        description: '',
      };

      // Reload list and switch to list view
      this.reloadList();
      this.showForm = false;

    } catch (err) {
      console.error('❌ Submit error:', err);
      this.toast('Failed to submit complaint', 'danger');
    } finally {
      this.isSubmitting = false;
    }
  }

  // ============================================================
  // RELOAD LIST (complaints filed by current user)
  // ============================================================
  reloadList(): void {
    const user = this.auth.getCurrentUser();
    const username = user?.username || '';

    this.myComplaints = getComplaintsByUser(username);
  }

  // ============================================================
  // EXPOSE HELPERS TO TEMPLATE
  // ============================================================
  getStatusColor = getStatusColor;
  getStatusLabel = getStatusLabel;
  getStatusIcon  = getStatusIcon;
  getPriorityColor = getPriorityColor;
  formatRelativeTime = formatRelativeTime;

  // ============================================================
  // TOAST HELPER
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
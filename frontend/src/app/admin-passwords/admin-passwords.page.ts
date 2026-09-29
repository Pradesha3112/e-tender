// ============================================================
// FILE: src/app/admin-passwords/admin-passwords.page.ts
// PURPOSE: Admin-only — reset passwords with custom modal
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-admin-passwords',
  templateUrl: './admin-passwords.page.html',
  styleUrls: ['./admin-passwords.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class AdminPasswordsPage implements OnInit {

  users: any[] = [];
  filteredUsers: any[] = [];
  isLoading = true;
  searchTerm = '';

  // ============================================================
  // MODAL STATE
  // ============================================================
  showModal = false;
  modalMode: 'self' | 'other' = 'self';
  modalTarget: any = null;
  isSaving = false;

  // Form data
  selfForm = {
    current: '',
    newPwd:  '',
    confirm: '',
  };

  otherForm = {
    newPwd:  '',
    confirm: '',
  };

  // Show/hide toggles
  showCurrentPwd = false;
  showNewPwd = false;
  showConfirmPwd = false;

  constructor(
    private router: Router,
    private apiService: ApiService,
    public auth: AuthService,
    private toastController: ToastController,
  ) {
    console.log('🔑 Admin Passwords page loaded');
  }

  ngOnInit() {
    this.loadUsers();
  }

  // ============================================================
  // LOAD USERS
  // ============================================================
  loadUsers() {
    this.isLoading = true;

    this.apiService.getUsers().subscribe({
      next: (res: any) => {
        let list = res?.data || [];

        const me = this.auth.getCurrentUser();
        const hasMe = list.some((u: any) => u.username === me?.username);

        if (!hasMe && me) {
          list = [
            {
              id: (me as any).id ?? 1,
              username: me.username,
              full_name: me.full_name,
              role: me.role,
              category_group: me.category_group,
              is_active: 1,
              _self: true,
            },
            ...list,
          ];
        } else {
          list = list.map((u: any) =>
            u.username === me?.username ? { ...u, _self: true } : u
          );
        }

        this.users = list;
        this.filteredUsers = [...this.users];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Error loading users:', err);
        this.isLoading = false;
        this.showToast('Could not load users', 'danger');
      },
    });
  }

  // ============================================================
  // OPEN MODAL — SELF (Change My Password)
  // ============================================================
  changeOwnPassword() {
    this.modalMode = 'self';
    this.modalTarget = null;
    this.selfForm = { current: '', newPwd: '', confirm: '' };
    this.resetToggles();
    this.showModal = true;
  }

  // ============================================================
  // OPEN MODAL — OTHERS (Reset User Password)
  // ============================================================
  resetPassword(user: any) {
    this.modalMode = 'other';
    this.modalTarget = user;
    this.otherForm = { newPwd: '', confirm: '' };
    this.resetToggles();
    this.showModal = true;
  }

  // ============================================================
  // CLOSE / CANCEL
  // ============================================================
  closeModal() {
    this.showModal = false;
    this.modalMode = 'self';
    this.modalTarget = null;
    this.selfForm = { current: '', newPwd: '', confirm: '' };
    this.otherForm = { newPwd: '', confirm: '' };
    this.resetToggles();
    this.isSaving = false;
  }

  cancelModal() {
    this.closeModal();
  }

  private resetToggles() {
    this.showCurrentPwd = false;
    this.showNewPwd = false;
    this.showConfirmPwd = false;
  }

  // ============================================================
  // TOGGLES
  // ============================================================
  toggleCurrentPwd() { this.showCurrentPwd = !this.showCurrentPwd; }
  toggleNewPwd()     { this.showNewPwd     = !this.showNewPwd;     }
  toggleConfirmPwd() { this.showConfirmPwd = !this.showConfirmPwd; }

  // ============================================================
  // SAVE — SELF
  // ============================================================
  async saveSelf() {
    const current = this.selfForm.current.trim();
    const newPwd  = this.selfForm.newPwd.trim();
    const confirm = this.selfForm.confirm.trim();

    if (!current) {
      this.showToast('Current password required', 'warning');
      return;
    }
    if (newPwd.length < 4) {
      this.showToast('New password must be at least 4 characters', 'warning');
      return;
    }
    if (newPwd !== confirm) {
      this.showToast('New passwords do not match', 'warning');
      return;
    }

    const me = this.auth.getCurrentUser();
    if (!me) return;

    this.isSaving = true;

    // 1. Verify current password
    this.apiService.verifyCredentials(me.username, current).subscribe({
      next: () => {
        // 2. Update password
        this.apiService.updateUser((me as any).id ?? 1, { password: newPwd }).subscribe({
          next: () => {
            this.isSaving = false;
            this.closeModal();
            this.showToast('Password updated — please login again', 'success');
            setTimeout(() => this.auth.logout(), 1200);
          },
          error: (err) => {
            this.isSaving = false;
            this.showToast(err?.error?.error || 'Failed to update password', 'danger');
          },
        });
      },
      error: () => {
        this.isSaving = false;
        this.showToast('Current password is incorrect', 'danger');
      },
    });
  }

  // ============================================================
  // SAVE — OTHER
  // ============================================================
  saveOther() {
    const newPwd  = this.otherForm.newPwd.trim();
    const confirm = this.otherForm.confirm.trim();

    if (!newPwd || newPwd.length < 4) {
      this.showToast('Password must be at least 4 characters', 'warning');
      return;
    }
    if (newPwd !== confirm) {
      this.showToast('Passwords do not match', 'warning');
      return;
    }

    if (!this.modalTarget) return;

    this.isSaving = true;

    this.apiService.updateUser(this.modalTarget.id, { password: newPwd }).subscribe({
      next: () => {
        this.isSaving = false;
        const targetUsername = this.modalTarget.username;
        this.closeModal();
        this.showToast(`Password reset for ${targetUsername}`, 'success');
      },
      error: (err) => {
        this.isSaving = false;
        this.showToast(err?.error?.error || 'Failed to reset password', 'danger');
      },
    });
  }

  // ============================================================
  // SEARCH
  // ============================================================
  filterUsers() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) {
      this.filteredUsers = [...this.users];
      return;
    }
    this.filteredUsers = this.users.filter(u =>
      (u.username || '').toLowerCase().includes(t) ||
      (u.full_name || '').toLowerCase().includes(t) ||
      (u.role || '').toLowerCase().includes(t)
    );
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredUsers = [...this.users];
  }

  // ============================================================
  // BADGES
  // ============================================================
  getRoleColor(role: string): string {
    if (role === 'admin')       return 'danger';
    if (role === 'super_admin') return 'warning';
    if (role === 'clerk')       return 'primary';
    return 'medium';
  }

  getRoleLabel(role: string): string {
    if (role === 'admin')       return 'Admin';
    if (role === 'super_admin') return 'Super Admin';
    if (role === 'clerk')       return 'Clerk';
    return role;
  }

  // ============================================================
  // UI
  // ============================================================
  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  goBack() {
    this.router.navigateByUrl('/profile');
  }
}
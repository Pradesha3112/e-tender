// ============================================================
// FILE: src/app/admin-passwords/admin-passwords.page.ts
// PURPOSE: Admin-only — reset any user's password
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';

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

  constructor(
    private router: Router,
    private apiService: ApiService,
    public auth: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
  ) {
    console.log('🔑 Admin Passwords page loaded');
  }

  ngOnInit() {
    this.loadUsers();
  }
  loadUsers() {
    this.isLoading = true;

    this.apiService.getUsers().subscribe({
      next: (res: any) => {
        let list = res?.data || [];

        // Prepend admin itself (may or may not be in the /users response)
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
          // Mark the matching row as "self"
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
  // SELF-UPDATE — only allowed for admin's own row
  // ============================================================
  async changeOwnPassword() {
    const alert = await this.alertController.create({
      header: 'Change Your Password',
      message: 'Enter your current password, then your new password.',
      inputs: [
        {
          name: 'current',
          type: 'password',
          placeholder: 'Current password (admin)',
          attributes: { minlength: 1 },
        },
        {
          name: 'password',
          type: 'password',
          placeholder: 'New password (min 4)',
          attributes: { minlength: 4 },
        },
        {
          name: 'confirm',
          type: 'password',
          placeholder: 'Confirm new password',
          attributes: { minlength: 4 },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Update',
          handler: (data) => {
            const current = (data.current || '').trim();
            const pw      = (data.password || '').trim();
            const cf      = (data.confirm  || '').trim();

            if (!current) {
              this.showToast('Current password required', 'warning');
              return false;
            }
            if (pw.length < 4) {
              this.showToast('New password must be at least 4 characters', 'warning');
              return false;
            }
            if (pw !== cf) {
              this.showToast('New passwords do not match', 'warning');
              return false;
            }

            this.performSelfChange(current, pw);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private performSelfChange(currentPassword: string, newPassword: string) {
    const me = this.auth.getCurrentUser();
    if (!me) return;

    // 1. Verify current password by attempting a fresh login
    this.apiService['http'].post(`${this.apiService['apiUrl']}/login`, {
      username: me.username,
      password: currentPassword,
    }).subscribe({
      next: () => {
        // 2. Current password OK → update
        this.apiService.updateUser((me as any).id ?? 1, { password: newPassword })
          .subscribe({
            next: () => {
              this.showToast('Password updated — please login again', 'success');
              setTimeout(() => this.auth.logout(), 1200);
            },
            error: (err) => {
              this.showToast(
                err?.error?.error || 'Failed to update password',
                'danger'
              );
            },
          });
      },
      error: () => {
        this.showToast('Current password is incorrect', 'danger');
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
  // ROLE BADGES
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
  // RESET PASSWORD
  // ============================================================
  async resetPassword(user: any) {
    const alert = await this.alertController.create({
      header: `Reset Password`,
      subHeader: `${user.full_name} (@${user.username})`,
      message: 'Enter a new password (minimum 4 characters)',
      inputs: [
        {
          name: 'password',
          type: 'password',
          placeholder: 'New password',
          attributes: {
            minlength: 4,
            autocomplete: 'new-password',
          },
        },
        {
          name: 'confirm',
          type: 'password',
          placeholder: 'Confirm password',
          attributes: {
            minlength: 4,
            autocomplete: 'new-password',
          },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reset',
          role: 'destructive',
          handler: (data) => {
            const pw = (data.password || '').trim();
            const cf = (data.confirm || '').trim();

            if (!pw || pw.length < 4) {
              this.showToast('Password must be at least 4 characters', 'warning');
              return false;    // keep alert open
            }

            if (pw !== cf) {
              this.showToast('Passwords do not match', 'warning');
              return false;
            }

            this.performReset(user, pw);
            return true;
          },
        },
      ],
    });

    await alert.present();
  }

  private performReset(user: any, newPassword: string) {
    this.apiService.updateUser(user.id, { password: newPassword }).subscribe({
      next: () => {
        this.showToast(`Password reset for ${user.username}`, 'success');
      },
      error: (err) => {
        this.showToast(
          err?.error?.error || 'Failed to reset password',
          'danger'
        );
      },
    });
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
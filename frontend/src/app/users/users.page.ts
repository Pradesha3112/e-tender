// ============================================================
// FILE: src/app/users/users.page.ts
// PURPOSE: User Management — list / toggle / delete users
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
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class UsersPage implements OnInit {

  allUsers: any[] = [];
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
    console.log('👥 Users page loaded');
  }

  ngOnInit() {
    this.loadUsers();
  }

  // ============================================================
  // HELPERS
  // ============================================================
  get canCreateSuperAdmin(): boolean {
    return this.auth.canCreateRole('super_admin');
  }

  get canCreateClerk(): boolean {
    return this.auth.canCreateRole('clerk');
  }

  get roleLabel(): string {
    const r = this.auth.getRole();
    if (r === 'admin')       return 'ADMIN';
    if (r === 'super_admin') return 'SUPER ADMIN';
    return '';
  }

  // ============================================================
  // LOAD
  // ============================================================
  loadUsers() {
    this.isLoading = true;
    this.apiService.getUsers().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.allUsers = res.data || [];
          this.filteredUsers = [...this.allUsers];
        }
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
  // SEARCH
  // ============================================================
  filterUsers() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) {
      this.filteredUsers = [...this.allUsers];
      return;
    }
    this.filteredUsers = this.allUsers.filter(u =>
      (u.username || '').toLowerCase().includes(t) ||
      (u.full_name || '').toLowerCase().includes(t) ||
      (u.role || '').toLowerCase().includes(t)
    );
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredUsers = [...this.allUsers];
  }

  // ============================================================
  // ROLE / GROUP BADGES
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

  getGroupLabel(group: string): string {
    if (group === 'adfm_1') return 'ADFM/I';
    if (group === 'adfm_2') return 'ADFM/II';
    return 'All';
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  canManage(user: any): boolean {
    return this.auth.canManageUser(user.role);
  }

  openUserForm(user?: any) {
    if (user) {
      this.router.navigate(['/user-form', user.id]);
    } else {
      this.router.navigateByUrl('/user-form');
    }
  }

  async toggleUser(user: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: user.is_active ? 'Deactivate User?' : 'Activate User?',
      message: user.is_active
        ? `Deactivate ${user.full_name}? They will no longer be able to log in.`
        : `Activate ${user.full_name}? They will be able to log in again.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: user.is_active ? 'Deactivate' : 'Activate',
          handler: () => {
            this.apiService.toggleUser(user.id).subscribe({
              next: () => {
                this.showToast(
                  user.is_active ? 'User deactivated' : 'User activated',
                  'success'
                );
                this.loadUsers();
              },
              error: () => this.showToast('Failed to toggle user', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  async deleteUser(user: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Delete User?',
      message: `Permanently delete ${user.full_name} (@${user.username})? This cannot be undone. Their bills will remain visible to their parent admin.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.apiService.deleteUser(user.id).subscribe({
              next: () => {
                this.showToast('User deleted', 'success');
                this.loadUsers();
              },
              error: () => this.showToast('Failed to delete user', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  // ============================================================
  // UI HELPERS
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
    this.router.navigateByUrl('/dashboard');
  }
}
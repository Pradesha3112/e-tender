// ============================================================
// FILE: src/app/user-form/user-form.page.ts
// PURPOSE: Create / edit a user
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-user-form',
  templateUrl: './user-form.page.html',
  styleUrls: ['./user-form.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class UserFormPage implements OnInit {

  // Mode
  isEditMode = false;
  userId: number | null = null;
  isLoading = false;
  isSaving = false;

  // Form fields
  form = {
    username: '',
    password: '',
    full_name: '',
    role: 'clerk' as 'super_admin' | 'clerk',
    category_group: 'adfm_1' as 'adfm_1' | 'adfm_2' | 'all',
    designation: '',
    phone: '',
    email: '',
  };

  // Available roles for THIS user to create
  availableRoles: { value: string; label: string }[] = [];

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private apiService: ApiService,
    public auth: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
  ) {
    console.log('📝 User form loaded');
  }

  ngOnInit() {
    // Build available roles based on who's logged in
    if (this.auth.canCreateRole('super_admin')) {
      this.availableRoles.push({ value: 'super_admin', label: 'Super Admin (ADFM/I or II)' });
    }
    if (this.auth.canCreateRole('clerk')) {
      this.availableRoles.push({ value: 'clerk', label: 'Clerk' });
    }

    // Edit mode?
    this.route.params.subscribe(params => {
      const id = params['id'];
      if (id) {
        this.isEditMode = true;
        this.userId = Number(id);
        this.loadUser();
      }
    });
  }

  // ============================================================
  // HELPERS
  // ============================================================
  get canEditRole(): boolean {
    // Only admin can change role/group of an existing super_admin
    return !this.isEditMode || this.auth.isAdmin();
  }

  get canChangeGroup(): boolean {
    return this.auth.isAdmin();     // only admin can pick adfm_1 / adfm_2
  }

  // ============================================================
  // LOAD (edit)
  // ============================================================
  loadUser() {
    if (!this.userId) return;
    this.isLoading = true;

    this.apiService.getUsers().subscribe({
      next: (res: any) => {
        const user = (res.data || []).find((u: any) => u.id === this.userId);
        if (user) {
          this.form.username       = user.username || '';
          this.form.full_name      = user.full_name || '';
          this.form.role           = user.role || 'clerk';
          this.form.category_group = user.category_group || 'adfm_1';
          this.form.designation    = user.designation || '';
          this.form.phone          = user.phone || '';
          this.form.email          = user.email || '';
        }
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.showToast('Could not load user', 'danger');
      },
    });
  }

  // ============================================================
  // SAVE
  // ============================================================
  save() {
    // Validation
    if (!this.form.full_name.trim()) {
      this.showToast('Full name is required', 'warning');
      return;
    }
    if (!this.isEditMode && (!this.form.username.trim() || !this.form.password)) {
      this.showToast('Username and password are required', 'warning');
      return;
    }
    if (!this.isEditMode && this.form.password.length < 4) {
      this.showToast('Password must be at least 4 characters', 'warning');
      return;
    }
    if (this.form.role === 'super_admin' && this.form.category_group === 'all') {
      this.showToast('Super Admin must belong to ADFM/I or ADFM/II', 'warning');
      return;
    }

    this.isSaving = true;

    if (this.isEditMode && this.userId) {
      // ---- UPDATE ----
      const payload: any = {
        full_name:   this.form.full_name,
        designation: this.form.designation,
        phone:       this.form.phone,
        email:       this.form.email,
      };
      if (this.form.password) {
        payload.password = this.form.password;
      }
      if (this.canChangeGroup && this.form.role === 'super_admin') {
        payload.category_group = this.form.category_group;
      }

      this.apiService.updateUser(this.userId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.showToast('User updated successfully', 'success');
          setTimeout(() => this.goBack(), 800);
        },
        error: (err) => {
          this.isSaving = false;
          this.showToast(err?.error?.error || 'Update failed', 'danger');
        },
      });

    } else {
      // ---- CREATE ----
      const payload: any = {
        username:       this.form.username.trim().toLowerCase(),
        password:       this.form.password,
        full_name:      this.form.full_name,
        role:           this.form.role,
        category_group: this.form.category_group,
        designation:    this.form.designation,
        phone:          this.form.phone,
        email:          this.form.email,
      };

      this.apiService.createUser(payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.showToast('User created successfully', 'success');
          setTimeout(() => this.goBack(), 800);
        },
        error: (err) => {
          this.isSaving = false;
          this.showToast(err?.error?.error || 'Create failed', 'danger');
        },
      });
    }
  }

  // ============================================================
  // UI
  // ============================================================
  goBack() {
    this.router.navigateByUrl('/users');
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }
}
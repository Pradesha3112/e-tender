// ============================================================
// FILE: src/app/login/login.page.ts
// PURPOSE: Login — with password toggle, dummy role, complaints
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonItem, IonInput,
  IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trainOutline, receiptOutline, personOutline, lockClosedOutline,
  alertCircleOutline, logInOutline, informationCircleOutline,
  eyeOutline, eyeOffOutline, shieldCheckmarkOutline,
  chatbubbleEllipsesOutline, closeOutline, sendOutline,
} from 'ionicons/icons';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonCard, IonCardContent, IonItem, IonInput,
    IonButton, IonIcon, IonSpinner,
    IonSelect, IonSelectOption,
  ],
})
export class LoginPage implements OnInit {

  // Form fields
  username = '';
  password = '';
  selectedRole = 'sr_drm';

  // UI state
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  roles = [
    { value: 'sr_drm',    label: 'Sr. DRM' },
    { value: 'adrm_1',    label: 'ADRM I/MDU' },
    { value: 'adrm_2',    label: 'ADRM II/MDU' },
    { value: 'sso',       label: 'SSO' },
    { value: 'sso_admin', label: 'SSO Admin' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    addIcons({
      trainOutline, receiptOutline, personOutline, lockClosedOutline,
      alertCircleOutline, logInOutline, informationCircleOutline,
      eyeOutline, eyeOffOutline, shieldCheckmarkOutline,
      chatbubbleEllipsesOutline, closeOutline, sendOutline,
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.redirectByRole();
    }
  }

  // ============================================================
  // PASSWORD TOGGLE
  // ============================================================
  togglePassword(): void {
    this.showPassword = !this.showPassword;
  }

  // ============================================================
  // LOGIN
  // ============================================================
  login(): void {
    this.errorMessage = '';

    if (!this.username.trim() || !this.password) {
      this.errorMessage = 'Please enter username and password';
      return;
    }

    this.isLoading = true;

    this.auth.login(this.username.trim(), this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.success) {
          this.redirectByRole();
        } else {
          this.errorMessage = res.error || 'Invalid credentials';
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.error || 'Server error — is Flask running?';
      },
    });
  }

  private redirectByRole(): void {
    this.router.navigateByUrl('/dashboard', { replaceUrl: true });
  }

  fillAdmin(): void {
    this.username = 'admin';
    this.password = 'admin';
    this.selectedRole = 'sr_drm';
  }

  // ============================================================
  // COMPLAINT — role gating
  // ============================================================
  get showComplaintButton(): boolean {
    return this.selectedRole === 'sso' || this.selectedRole === 'sso_admin';
  }

  // ============================================================
  // COMPLAINT — navigate to full page
  // ============================================================
  goToComplaintPage(): void {
    this.router.navigateByUrl('/complaint-raise');
  }
}
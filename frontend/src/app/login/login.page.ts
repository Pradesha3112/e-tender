// ============================================================
// FILE: src/app/login/login.page.ts
// PURPOSE: Login — username, password (with eye), dummy role
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
  selectedRole = 'admin';    // ⚠️ DUMMY — cosmetic only, never sent to backend

  // UI state
  showPassword = false;
  isLoading = false;
  errorMessage = '';

  // Dummy roles for dropdown
  roles = [
    { value: 'admin',       label: 'Admin' },
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'clerk',       label: 'Clerk' },
  ];

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    addIcons({
      trainOutline, receiptOutline, personOutline, lockClosedOutline,
      alertCircleOutline, logInOutline, informationCircleOutline,
      eyeOutline, eyeOffOutline, shieldCheckmarkOutline,
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.redirectByRole();
    }
  }

  // ============================================================
  // SHOW / HIDE PASSWORD
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

    // ⚠️ selectedRole is NOT sent — backend determines role
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
    this.selectedRole = 'admin';
  }
}
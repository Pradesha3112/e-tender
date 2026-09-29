// ============================================================
// FILE: src/app/login/login.page.ts
// PURPOSE: Login page — calls /login, stores JWT + user
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonCard, IonCardContent, IonItem, IonInput,
  IonButton, IonIcon, IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  trainOutline, receiptOutline, personOutline, lockClosedOutline,
  alertCircleOutline, logInOutline, informationCircleOutline,
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
  ],
})
export class LoginPage implements OnInit {

  username = '';
  password = '';
  isLoading = false;
  errorMessage = '';

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {
    addIcons({
      trainOutline, receiptOutline, personOutline, lockClosedOutline,
      alertCircleOutline, logInOutline, informationCircleOutline,
    });
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) {
      this.redirectByRole();
    }
  }

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
  }
}
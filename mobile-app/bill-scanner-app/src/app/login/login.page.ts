import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class LoginPage {
  username: string = 'admin';
  password: string = 'admin';
  isLoading: boolean = false;
  errorMessage: string = '';

  constructor(private router: Router) {
    console.log('🔐 Login page loaded');
  }

  login() {
    this.isLoading = true;
    this.errorMessage = '';

    // Simple validation - hardcoded credentials
    if (this.username === 'admin' && this.password === 'admin') {
      setTimeout(() => {
        this.isLoading = false;
        localStorage.setItem('isLoggedIn', 'true');
        this.router.navigateByUrl('/dashboard');
      }, 1000);
    } else {
      setTimeout(() => {
        this.isLoading = false;
        this.errorMessage = '❌ Invalid username or password. Please try again.';
      }, 1000);
    }
  }
}
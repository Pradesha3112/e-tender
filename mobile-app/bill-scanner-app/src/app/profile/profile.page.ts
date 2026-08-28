// ============================================
// FILE 3: profile.page.ts                    //
// RAILWAY E-BILLING SYSTEM - PROFILE LOGIC   //
// ============================================
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class ProfilePage implements OnInit {
  isDarkMode: boolean = false;
  stats = {
    totalBills: 42,
    totalAmount: '₹12,450',
    thisMonth: 8
  };

  constructor(private router: Router) {
    console.log('🚆 Railway Profile Page initialized');
    const savedTheme = localStorage.getItem('app-theme');
    this.isDarkMode = savedTheme === 'dark';
  }

  ngOnInit() {
    // Load user data
    this.loadUserData();
  }

  loadUserData() {
    // In a real app, this would load from a service
    console.log('📋 Loading user data...');
  }

  toggleTheme() {
    console.log('🌓 Theme toggled:', this.isDarkMode);
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('app-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('app-theme', 'light');
    }
  }

  editProfile() {
    console.log('🟢 Edit Profile clicked');
    // Navigate to edit profile page
    // this.router.navigateByUrl('/edit-profile');
  }

  changePassword() {
    console.log('🟢 Change Password clicked');
    // Navigate to change password page
    // this.router.navigateByUrl('/change-password');
  }

  goToHelp() {
    console.log('🟢 Help & Support clicked');
    // Navigate to help page
    // this.router.navigateByUrl('/help');
  }

  goToAbout() {
    console.log('🟢 About clicked');
    // Navigate to about page
    // this.router.navigateByUrl('/about');
  }

  logout() {
    console.log('🚪 Logging out...');
    // Clear local storage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('app-theme');
    
    // Navigate to login page
    this.router.navigateByUrl('/login');
  }

  goToDashboard() {
    this.router.navigateByUrl('/dashboard');
  }

  goToBills() {
    this.router.navigateByUrl('/bills');
  }

  goToUpload() {
    this.router.navigateByUrl('/upload');
  }

  goToExport() {
    this.router.navigateByUrl('/export');
  }
}
// ============================================================
// FILE: src/app/profile/profile.page.ts
// PURPOSE: Profile — role-aware (admin gets password + recycle)
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { AppShellComponent } from '../shared/shell/shell.component';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule,  AppShellComponent,  ],
})
export class ProfilePage implements OnInit {

  constructor(
    private router: Router,
    public auth: AuthService,
  ) {
    console.log('🚆 Railway Profile Page initialized');
  }

  ngOnInit() {}

  // ============================================================
  // USER INFO
  // ============================================================
  get user() {
    return this.auth.getCurrentUser();
  }

  get roleLabel(): string {
    const r = this.auth.getRole();
    if (r === 'admin')       return 'Sr. DRM';
    if (r === 'super_admin') {
      return this.auth.getCategoryGroup() === 'adfm_1'
        ? 'ADRM I/MDU'
        : 'ADRM II/MDU';
    }
    if (r === 'clerk')       return 'SSO';
    return '—';
  }

  get groupLabel(): string {
    const g = this.auth.getCategoryGroup();
    if (g === 'adfm_1') return 'ADFM/I Group';
    if (g === 'adfm_2') return 'ADFM/II Group';
    return 'All Categories';
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================
  get canManageUsers(): boolean {
    return this.auth.canManageUsers();
  }

  get canChangePassword(): boolean {
    return this.auth.isAdmin();
  }

  get canViewRecycleBin(): boolean {
    return this.auth.canViewRecycleBin();
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  goToUsers() {
    this.router.navigateByUrl('/users');
  }

  goToChangePassword() {
    this.router.navigateByUrl('/admin-passwords');
  }

  goToRecycleBin() {
    this.router.navigateByUrl('/recycle-bin');
  }

  logout() {
    this.auth.logout();
  }
}
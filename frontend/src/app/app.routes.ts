import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'login',
    loadComponent: () => import('./login/login.page').then(m => m.LoginPage)
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.page').then(m => m.DashboardPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'upload',
    loadComponent: () => import('./upload/upload.page').then(m => m.UploadPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'bills',
    loadComponent: () => import('./bills/bills.page').then(m => m.BillsPage),
    canActivate: [AuthGuard]
  },
    // USER MANAGEMENT — admin + super_admin only
  {
    path: 'users',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'super_admin'] },
    loadComponent: () =>
      import('./users/users.page').then(m => m.UsersPage),
  },
  {
    path: 'user-form',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'super_admin'] },
    loadComponent: () =>
      import('./user-form/user-form.page').then(m => m.UserFormPage),
  },
  {
    path: 'user-form/:id',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin', 'super_admin'] },
    loadComponent: () =>
      import('./user-form/user-form.page').then(m => m.UserFormPage),
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile/profile.page').then(m => m.ProfilePage),
    canActivate: [AuthGuard]
  },
  {
    path: 'export',
    loadComponent: () => import('./export/export.page').then(m => m.ExportPage),
    canActivate: [AuthGuard]
  },
  {
    path: 'bill-detail/:id',
    loadComponent: () => import('./bill-detail/bill-detail.page').then(m => m.BillDetailPage),
    canActivate: [AuthGuard]
  },  // ADMIN-ONLY — Password reset
  {
    path: 'admin-passwords',
    canActivate: [AuthGuard, RoleGuard],
    data: { roles: ['admin'] },
    loadComponent: () =>
      import('./admin-passwords/admin-passwords.page')
        .then(m => m.AdminPasswordsPage),
  },
  {
    path: 'validation',
    loadComponent: () => import('./validation/validation.page').then(m => m.ValidationPage),
    canActivate: [AuthGuard]
  }
];
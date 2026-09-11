import { Routes } from '@angular/router';
import { AuthGuard } from './guards/auth.guard';

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
  },
  {
    path: 'validation',
    loadComponent: () => import('./validation/validation.page').then(m => m.ValidationPage),
    canActivate: [AuthGuard]
  }
];
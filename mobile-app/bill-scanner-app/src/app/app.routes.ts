import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.page').then(m => m.DashboardPage)
  },
  {
    path: 'upload',
    loadComponent: () => import('./upload/upload.page').then(m => m.UploadPage)
  },
  {
    path: 'validation',
    loadComponent: () => import('./validation/validation.page').then(m => m.ValidationPage)
  },
  {
    path: 'bills',
    loadComponent: () => import('./bills/bills.page').then(m => m.BillsPage)
  },
  {
    path: 'bill-detail/:id',
    loadComponent: () => import('./bill-detail/bill-detail.page').then(m => m.BillDetailPage)
  }
];
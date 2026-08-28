// ============================================
// FILE 3: dashboard.page.ts                  //
// RAILWAY E-BILLING SYSTEM - LOGIC           //
// ============================================
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class DashboardPage implements OnInit {
  recentBills: any[] = [];
  isLoading = true;
  isDarkMode: boolean = false;
  stats = {
    totalBills: 0,
    totalAmount: 0,
    thisMonth: 0
  };

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {
    console.log('🚆 Railway Dashboard initialized');
    const savedTheme = localStorage.getItem('app-theme');
    this.isDarkMode = savedTheme === 'dark';
  }

  ngOnInit() {
    this.loadRecentBills();
  }

  // load real bills from API
  loadRecentBills() {
    this.isLoading = true;
    this.apiService.getBills().subscribe({
      next: (response: any) => {
        console.log('📋 Bills received in dashboard:', response);
        if (response && response.success) {
          const bills = response.data || [];
          this.recentBills = bills.slice(0, 5);
          this.stats.totalBills = bills.length;
          this.stats.totalAmount = bills.reduce((sum: number, bill: any) => sum + (bill.total || 0), 0);
          const now = new Date();
          const thisMonth = bills.filter((bill: any) => {
            if (!bill.created_at) return false;
            const date = new Date(bill.created_at);
            return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
          });
          this.stats.thisMonth = thisMonth.length;
          console.log('📊 Stats:', this.stats);
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading bills:', error);
        this.isLoading = false;
        // fallback sample data
        this.recentBills = [
          { id: 1, vendor: 'Railway Catering', date: '2026-08-20', total: 149.50 },
          { id: 2, vendor: 'Platform Store', date: '2026-08-19', total: 67.25 },
          { id: 3, vendor: 'IRCTC E-Catering', date: '2026-08-18', total: 210.00 }
        ];
        this.stats.totalBills = 3;
        this.stats.totalAmount = 426.75;
        this.stats.thisMonth = 3;
      }
    });
  }

  // theme toggle
  toggleTheme() {
    this.isDarkMode = !this.isDarkMode;
    console.log('🌓 Theme toggled:', this.isDarkMode);
    if (this.isDarkMode) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('app-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('app-theme', 'light');
    }
  }

  // navigation methods (routing preserved)
  goToUpload() {
    console.log('🟢 Navigate to upload');
    this.router.navigateByUrl('/upload');
  }

  goToBills() {
    console.log('🟢 Navigate to bills');
    this.router.navigateByUrl('/bills');
  }

  goToDashboard() {
    console.log('🟢 Navigate to dashboard');
    this.router.navigateByUrl('/dashboard');
  }

  goToExport() {
    console.log('🟢 Navigate to export');
    this.router.navigateByUrl('/export');
  }

  goToProfile() {
    console.log('🟢 Navigate to profile');
    this.router.navigateByUrl('/profile');
  }

  viewBill(id: number) {
    console.log('🟢 View bill:', id);
    this.router.navigateByUrl(`/bill-detail/${id}`);
  }

  refreshDashboard() {
    this.loadRecentBills();
  }

  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }
}
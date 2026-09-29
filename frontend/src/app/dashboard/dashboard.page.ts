// ============================================================
// FILE: src/app/dashboard/dashboard.page.ts
// PURPOSE: Railway eOffice blue dashboard
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class DashboardPage implements OnInit, OnDestroy {

  // Data
  recentBills: any[] = [];
  notices: any[] = [];
  activity: any[] = [];

  // State
  isLoading = true;
  sidebarCollapsed = false;      // desktop toggle
  rightPanelOpen = true;         // desktop right panel

  stats = {
    totalBills: 0,
    totalAmount: 0,
    thisMonth: 0,
  };

  constructor(
    private router: Router,
    private apiService: ApiService,
    public auth: AuthService,
  ) {
    console.log('🚆 Railway Dashboard initialized');
  }

  ngOnInit() {
    this.loadAll();
  }

  ngOnDestroy() {
    // Reserved for future cleanup
  }

  // ============================================================
  // LOAD ALL DATA IN PARALLEL
  // ============================================================
  loadAll() {
    this.isLoading = true;

    // Bills
    this.apiService.getBills().subscribe({
      next: (res: any) => {
        if (res?.success) {
          const bills = res.data || [];
          this.recentBills = bills.slice(0, 5);
          this.stats.totalBills = bills.length;
          this.stats.totalAmount = bills.reduce(
            (sum: number, b: any) => sum + Number(b.total || 0), 0
          );
          const now = new Date();
          this.stats.thisMonth = bills.filter((b: any) => {
            if (!b.created_at) return false;
            const d = new Date(b.created_at);
            return d.getMonth() === now.getMonth()
              && d.getFullYear() === now.getFullYear();
          }).length;
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Bills error:', err);
        this.isLoading = false;
      },
    });

    // Notices
    this.apiService.getNotices().subscribe({
      next: (res: any) => {
        if (res?.success) this.notices = res.data || [];
      },
      error: (err) => console.warn('⚠️ Notices unavailable:', err),
    });

    // Activity
    this.apiService.getActivity().subscribe({
      next: (res: any) => {
        if (res?.success) this.activity = res.data || [];
      },
      error: (err) => console.warn('⚠️ Activity unavailable:', err),
    });
  }

  // ============================================================
  // USER / ROLE HELPERS
  // ============================================================
  get user() {
    return this.auth.getCurrentUser();
  }

  get roleLabel(): string {
    const r = this.auth.getRole();
    if (r === 'admin')       return 'ADMIN';
    if (r === 'super_admin') {
      return this.auth.getCategoryGroup() === 'adfm_1'
        ? 'ADFM/I — RENGASAMY'
        : 'ADFM/II — GOPINATH';
    }
    if (r === 'clerk')       return 'CLERK';
    return '';
  }

  get groupLabel(): string {
    const g = this.auth.getCategoryGroup();
    if (g === 'adfm_1') return 'ADFM/I GROUP';
    if (g === 'adfm_2') return 'ADFM/II GROUP';
    return 'ALL CATEGORIES';
  }

  get canManageUsers(): boolean {
    return this.auth.canManageUsers();
  }

  // ============================================================
  // THEME
  // ============================================================
  get isDarkMode(): boolean {
    return localStorage.getItem('app-theme') === 'dark';
  }

  toggleTheme() {
    const next = !this.isDarkMode;
    if (next) {
      document.documentElement.classList.add('dark-theme');
      localStorage.setItem('app-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-theme');
      localStorage.setItem('app-theme', 'light');
    }
  }

  toggleSidebar() {
    this.sidebarCollapsed = !this.sidebarCollapsed;
  }

  toggleRightPanel() {
    this.rightPanelOpen = !this.rightPanelOpen;
  }

  // ============================================================
  // NOTICE HELPERS
  // ============================================================
  get topNotice(): any | null {
    return this.notices.length > 0 ? this.notices[0] : null;
  }

  getNoticeClass(type: string): string {
    if (type === 'warning') return 'notice--warning';
    if (type === 'success') return 'notice--success';
    if (type === 'danger')  return 'notice--danger';
    return 'notice--info';
  }

  getNoticeIcon(type: string): string {
    if (type === 'warning') return 'alert-circle-outline';
    if (type === 'success') return 'checkmark-circle-outline';
    if (type === 'danger')  return 'close-circle-outline';
    return 'information-circle-outline';
  }

  // ============================================================
  // BILL HELPERS
  // ============================================================
  getCategoryShortName(category: string): string {
    if (!category) return 'Uncategorized';
    // Truncate long names
    const short = category.split(':')[0].split('/')[0].trim();
    return short.length > 20 ? short.substring(0, 20) + '…' : short;
  }

  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  formatCompactCurrency(amount: number): string {
    if (!amount) return '₹0';
    if (amount >= 10000000) return '₹' + (amount / 10000000).toFixed(1) + 'Cr';
    if (amount >= 100000)   return '₹' + (amount / 100000).toFixed(2) + 'L';
    if (amount >= 1000)     return '₹' + (amount / 1000).toFixed(1) + 'K';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  goToUpload()    { this.router.navigateByUrl('/upload'); }
  goToBills()     { this.router.navigateByUrl('/bills'); }
  goToDashboard() { this.router.navigateByUrl('/dashboard'); }
  goToExport()    { this.router.navigateByUrl('/export'); }
  goToProfile()   { this.router.navigateByUrl('/profile'); }
  goToUsers()     { this.router.navigateByUrl('/users'); }
  viewBill(id: number) { this.router.navigateByUrl(`/bill-detail/${id}`); }

  refreshDashboard() {
    this.loadAll();
  }
}
// ============================================================
// FILE: src/app/dashboard/dashboard.page.ts
// PURPOSE: Dashboard using shared AppShellComponent
//          + user activity table
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AppShellComponent } from '../shared/shell/shell.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, AppShellComponent],
})
export class DashboardPage implements OnInit {

  recentBills: any[] = [];
  userActivity: any[] = [];
  isLoading = true;

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

  // ============================================================
  // LOAD ALL DATA
  // ============================================================
  loadAll() {
    this.isLoading = true;

    // Bills (stats + recent)
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

    // User Activity
    this.apiService.getUserActivity().subscribe({
      next: (res: any) => {
        if (res?.success) this.userActivity = res.data || [];
      },
      error: (err) => console.warn('⚠️ User activity unavailable:', err),
    });
  }

  // ============================================================
  // USER HELPERS
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
    if (g === 'adfm_1') return 'ADFM/I GROUP';
    if (g === 'adfm_2') return 'ADFM/II GROUP';
    return 'ALL CATEGORIES';
  }

  get loginTime(): string {
    const raw = this.auth.getLoginTime();
    if (!raw) return '—';
    try {
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '—';
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return raw;
    }
  }

  // ============================================================
  // ACTIVITY HELPERS
  // ============================================================
  formatActivityTime(dateStr: string | null): string {
    if (!dateStr) return '—';
    try {
      const s = String(dateStr).trim();
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
      if (!m) return s;

      const [, year, month, day, hour, minute] = m;

      const date = new Date(Number(year), Number(month) - 1, Number(day),
                            Number(hour), Number(minute));
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return '—';
    }
  }

  getActivityRoleLabel(role: string): string {
    if (role === 'admin')       return 'Sr. DRM';
    if (role === 'super_admin') return 'ADRM';
    if (role === 'clerk')       return 'SSO';
    return role || '—';
  }

  getActivityGroupLabel(group: string): string {
    if (group === 'adfm_1') return 'ADFM/I';
    if (group === 'adfm_2') return 'ADFM/II';
    return 'All';
  }

  // ============================================================
  // BILL HELPERS
  // ============================================================
  getCategoryShortName(category: string): string {
    if (!category) return 'Uncategorized';
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
  goToExport()    { this.router.navigateByUrl('/export'); }
  goToProfile()   { this.router.navigateByUrl('/profile'); }
  goToUsers()     { this.router.navigateByUrl('/users'); }
  viewBill(id: number) { this.router.navigateByUrl(`/bill-detail/${id}`); }

  refreshDashboard() { this.loadAll(); }

  // ============================================================
  // SESSION HIGHLIGHTING
  // ============================================================
  get currentSessionId(): string | null {
    return this.auth.getSessionId();
  }
}
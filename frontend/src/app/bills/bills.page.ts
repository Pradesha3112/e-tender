// ============================================================
// FILE: src/app/bills/bills.page.ts
// PURPOSE: Bills list with soft-delete + reason + recycle bin
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';
import { AppShellComponent } from '../shared/shell/shell.component';

@Component({
  selector: 'app-bills',
  templateUrl: './bills.page.html',
  styleUrls: ['./bills.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule,
    AppShellComponent,
  ],
})
export class BillsPage implements OnInit {

  allBills: any[] = [];
  filteredBills: any[] = [];
  isLoading = true;
  searchTerm = '';

  stats = {
    totalAmount: 0,
  };

  filters = [
    { id: 'all',   label: 'All',        active: true  },
    { id: 'today', label: 'Today',      active: false },
    { id: 'week',  label: 'This Week',  active: false },
    { id: 'month', label: 'This Month', active: false },
  ];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController,
    private toastController: ToastController,
    public auth: AuthService,
  ) {
    console.log('✅ BILLS PAGE LOADED!');
  }

  ngOnInit() {
    this.loadBills();
  }

  // ============================================================
  // LOAD
  // ============================================================
  loadBills() {
    this.isLoading = true;

    this.apiService.getBills().subscribe({
      next: (response: any) => {
        console.log('📋 Bills received:', response);
        if (response && response.success) {
          this.allBills = response.data || [];
          this.filteredBills = [...this.allBills];
          this.calculateStats();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading bills:', error);
        this.isLoading = false;
        this.showAlert('Error', 'Could not load bills. Please check your connection.');
      },
    });
  }

  refreshBills() {
    this.loadBills();
  }

  // ============================================================
  // SEARCH
  // ============================================================
  filterBills() {
    const term = this.searchTerm.toLowerCase().trim();

    if (!term) {
      this.filteredBills = [...this.allBills];
      this.calculateStats();
      return;
    }

    this.filteredBills = this.allBills.filter(bill => {
      const vendor     = (bill.vendor || '').toLowerCase();
      const billNumber = (bill.bill_number || '').toLowerCase();
      const date       = (bill.date || '').toLowerCase();
      const gstin      = (bill.gstin || '').toLowerCase();

      return vendor.includes(term)
          || billNumber.includes(term)
          || date.includes(term)
          || gstin.includes(term);
    });

    this.calculateStats();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filters.forEach(f => f.active = false);
    this.filters[0].active = true;
    this.filteredBills = [...this.allBills];
    this.calculateStats();
  }

  // ============================================================
  // FILTER
  // ============================================================
  applyFilter(filter: any) {
    this.filters.forEach(f => f.active = false);
    filter.active = true;

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let filtered: any[] = [];

    if (filter.id === 'today') {
      filtered = this.allBills.filter(bill => {
        const billDate = bill.created_at ? new Date(bill.created_at) : new Date(bill.date);
        return billDate >= today;
      });
    } else if (filter.id === 'week') {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = this.allBills.filter(bill => {
        const billDate = bill.created_at ? new Date(bill.created_at) : new Date(bill.date);
        return billDate >= weekAgo;
      });
    } else if (filter.id === 'month') {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = this.allBills.filter(bill => {
        const billDate = bill.created_at ? new Date(bill.created_at) : new Date(bill.date);
        return billDate >= monthAgo;
      });
    } else {
      filtered = [...this.allBills];
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(bill => {
        const vendor     = (bill.vendor || '').toLowerCase();
        const billNumber = (bill.bill_number || '').toLowerCase();
        return vendor.includes(term) || billNumber.includes(term);
      });
    }

    this.filteredBills = filtered;
    this.calculateStats();
  }

  // ============================================================
  // STATS
  // ============================================================
  calculateStats() {
    this.stats.totalAmount = this.filteredBills.reduce(
      (sum, bill) => sum + Number(bill.total || 0), 0
    );
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  viewBill(id: number) {
    console.log('👁️ Viewing bill:', id);
    this.router.navigate(['/bill-detail', id]);
  }

  // ============================================================
  // SOFT DELETE — with role-based reason requirement
  // Admin       → no reason
  // Super Admin → reason required (3-500 chars)
  // Clerk       → reason required (3-500 chars)
  // ============================================================
  deleteBill(id: number, event: Event) {
    event.stopPropagation();
    this.confirmDelete(id);
  }

  async confirmDelete(id: number) {
    const bill = this.allBills.find(b => b.id === id);
    const billLabel = bill
      ? `"${bill.vendor}" (#${bill.bill_number || id})`
      : 'This bill';

    const role = this.auth.getRole();
    const requiresReason = role === 'super_admin' || role === 'clerk';

    // ---- Admin flow: no reason input ----
    if (!requiresReason) {
      const alert = await this.alertController.create({
        header: 'Move to Recycle Bin?',
        message: `${billLabel} will be moved to the recycle bin. You can restore or permanently delete it later.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Move to Bin',
            role: 'destructive',
            handler: () => this.performDelete(id, undefined),
          },
        ],
      });
      await alert.present();
      return;
    }

    // ---- S.A. / Clerk flow: reason input required ----
    const alert = await this.alertController.create({
      header: 'Move to Recycle Bin?',
      message: `${billLabel} will be moved to the recycle bin.`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for deletion (required, min 3 chars)',
          attributes: {
            maxlength: 500,
            minlength: 3,
            rows: 3,
          },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move to Bin',
          role: 'destructive',
          handler: (data) => {
            const reason = (data.reason || '').trim();
            if (!reason || reason.length < 3) {
              this.showToast('Reason must be at least 3 characters', 'warning');
              return false;   // keep alert open
            }
            if (reason.length > 500) {
              this.showToast('Reason too long (max 500 chars)', 'warning');
              return false;
            }
            this.performDelete(id, reason);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private performDelete(id: number, reason?: string) {
    this.apiService.deleteBill(id, reason).subscribe({
      next: (res) => {
        console.log('✅ Bill moved to recycle bin:', res);
        this.loadBills();
        this.showToast('Bill moved to recycle bin', 'success');
      },
      error: (error) => {
        console.error('❌ Delete error:', error);
        this.showToast(
          error?.error?.error || 'Failed to delete bill',
          'danger'
        );
      },
    });
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  goToUpload() {
    if (this.searchTerm) {
      this.clearSearch();
    } else {
      this.router.navigate(['/upload']);
    }
  }

  goToExport() {
    console.log('📤 Navigating to export...');
    this.router.navigateByUrl('/export');
  }

  goToRecycleBin() {
    this.router.navigateByUrl('/recycle-bin');
  }

  // ============================================================
  // UI
  // ============================================================
  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
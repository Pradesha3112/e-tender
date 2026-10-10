// ============================================================
// FILE: src/app/recycle-bin/recycle-bin.page.ts
// PURPOSE: View / restore / permanently delete soft-deleted bills
// ============================================================

import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';

@Component({
  selector: 'app-recycle-bin',
  templateUrl: './recycle-bin.page.html',
  styleUrls: ['./recycle-bin.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule],
})
export class RecycleBinPage implements OnInit {

  allBills: any[] = [];
  filteredBills: any[] = [];
  isLoading = true;
  searchTerm = '';

  constructor(
    private router: Router,
    private apiService: ApiService,
    public auth: AuthService,
    private alertController: AlertController,
    private toastController: ToastController,
  ) {
    console.log('♻️ Recycle Bin page loaded');
  }

  ngOnInit() {
    this.loadDeletedBills();
  }

  // ============================================================
  // PERMISSIONS
  // ============================================================
  get canRestore(): boolean {
    return this.auth.canRestoreBill();     // admin only
  }

  get canHardDelete(): boolean {
    return this.auth.canHardDeleteBill();  // admin only
  }

  // ============================================================
  // LOAD
  // ============================================================
  loadDeletedBills() {
    this.isLoading = true;

    this.apiService.getDeletedBills().subscribe({
      next: (res: any) => {
        if (res && res.success) {
          this.allBills = res.data || [];
          this.filteredBills = [...this.allBills];
        }
        this.isLoading = false;
      },
      error: (err) => {
        console.error('❌ Error loading deleted bills:', err);
        this.isLoading = false;
        this.showToast('Could not load recycle bin', 'danger');
      },
    });
  }

  refresh() {
    this.loadDeletedBills();
  }

  // ============================================================
  // SEARCH
  // ============================================================
  filterBills() {
    const t = this.searchTerm.toLowerCase().trim();
    if (!t) {
      this.filteredBills = [...this.allBills];
      return;
    }
    this.filteredBills = this.allBills.filter(b =>
      (b.vendor || '').toLowerCase().includes(t) ||
      (b.bill_number || '').toLowerCase().includes(t) ||
      (b.deleted_by || '').toLowerCase().includes(t)
    );
  }

  clearSearch() {
    this.searchTerm = '';
    this.filteredBills = [...this.allBills];
  }

  // ============================================================
  // HELPERS
  // ============================================================
  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }

  getRelativeTime(dateStr: string): string {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1)  return 'just now';
      if (diffMin < 60) return `${diffMin} min ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24)  return `${diffHr} hr ago`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 30) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
      return this.formatDate(dateStr);
    } catch {
      return dateStr;
    }
  }

   getRoleLabel(role: string): string {
    if (role === 'admin')       return 'Sr. DRM';
    if (role === 'super_admin') return 'ADRM';
    if (role === 'clerk')       return 'SSO';
    return role || 'Unknown';
  }

  viewBill(id: number) {
    this.router.navigate(['/bill-detail', id]);
  }

  // ============================================================
  // RESTORE
  // ============================================================
  async confirmRestore(bill: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: 'Restore Bill?',
      message: `Restore "${bill.vendor}" (#${bill.bill_number || bill.id}) back to active bills?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Restore',
          handler: () => this.performRestore(bill),
        },
      ],
    });

    await alert.present();
  }

  private performRestore(bill: any) {
    this.apiService.restoreBill(bill.id).subscribe({
      next: () => {
        this.showToast('Bill restored successfully', 'success');
        this.loadDeletedBills();
      },
      error: (err) => {
        console.error('❌ Restore error:', err);
        this.showToast(
          err?.error?.error || 'Failed to restore bill',
          'danger'
        );
      },
    });
  }

  // ============================================================
  // HARD DELETE
  // ============================================================
  async confirmHardDelete(bill: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertController.create({
      header: '⚠️ Permanently Delete?',
      message: `Permanently delete "${bill.vendor}" (#${bill.bill_number || bill.id})? This action CANNOT be undone.`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Delete Forever',
          role: 'destructive',
          handler: () => this.performHardDelete(bill),
        },
      ],
    });

    await alert.present();
  }

  private performHardDelete(bill: any) {
    this.apiService.hardDeleteBill(bill.id).subscribe({
      next: () => {
        this.showToast('Bill permanently deleted', 'success');
        this.loadDeletedBills();
      },
      error: (err) => {
        console.error('❌ Hard delete error:', err);
        this.showToast(
          err?.error?.error || 'Failed to permanently delete',
          'danger'
        );
      },
    });
  }

  // ============================================================
  // UI
  // ============================================================
  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  goBack() {
    this.router.navigateByUrl('/profile');
  }
}
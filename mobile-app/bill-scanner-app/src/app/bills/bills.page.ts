import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AlertController } from '@ionic/angular';

@Component({
  selector: 'app-bills',
  templateUrl: './bills.page.html',
  styleUrls: ['./bills.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule]
})
export class BillsPage implements OnInit {
  allBills: any[] = [];
  filteredBills: any[] = [];
  isLoading = true;
  searchTerm = '';
  stats = {
    totalAmount: 0
  };

  filters = [
    { id: 'all', label: 'All', active: true },
    { id: 'today', label: 'Today', active: false },
    { id: 'week', label: 'This Week', active: false },
    { id: 'month', label: 'This Month', active: false }
  ];

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController
  ) {
    console.log('✅ BILLS PAGE LOADED!');
  }

  ngOnInit() {
    this.loadBills();
  }

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
      }
    });
  }

  // SEARCH FUNCTION
  filterBills() {
    const term = this.searchTerm.toLowerCase().trim();
    
    if (!term) {
      this.filteredBills = [...this.allBills];
      this.calculateStats();
      return;
    }

    this.filteredBills = this.allBills.filter(bill => {
      const vendor = (bill.vendor || '').toLowerCase();
      const billNumber = (bill.bill_number || '').toLowerCase();
      const date = (bill.date || '').toLowerCase();
      const gstin = (bill.gstin || '').toLowerCase();
      
      return vendor.includes(term) || 
             billNumber.includes(term) || 
             date.includes(term) || 
             gstin.includes(term);
    });
    
    this.calculateStats();
  }

  // APPLY FILTER
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
    
    // Apply search term if exists
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(bill => {
        const vendor = (bill.vendor || '').toLowerCase();
        const billNumber = (bill.bill_number || '').toLowerCase();
        return vendor.includes(term) || billNumber.includes(term);
      });
    }
    
    this.filteredBills = filtered;
    this.calculateStats();
  }

  // CLEAR SEARCH
  clearSearch() {
    this.searchTerm = '';
    this.filters.forEach(f => f.active = false);
    this.filters[0].active = true;
    this.filteredBills = [...this.allBills];
    this.calculateStats();
  }

  // CALCULATE STATS
  calculateStats() {
    this.stats.totalAmount = this.filteredBills.reduce(
      (sum, bill) => sum + Number(bill.total || 0), 0
    );
  }

  viewBill(id: number) {
    console.log('👁️ Viewing bill:', id);
    this.router.navigate(['/bill-detail', id]);
  }

  deleteBill(id: number, event: Event) {
    event.stopPropagation();
    this.confirmDelete(id);
  }

  async confirmDelete(id: number) {
    const alert = await this.alertController.create({
      header: 'Delete Bill',
      message: 'Are you sure you want to delete this bill?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.apiService.deleteBill(id).subscribe({
              next: () => {
                console.log('✅ Bill deleted');
                this.loadBills();
                this.showAlert('Success', 'Bill deleted successfully!');
              },
              error: (error) => {
                console.error('❌ Delete error:', error);
                this.showAlert('Error', 'Failed to delete bill.');
              }
            });
          }
        }
      ]
    });
    await alert.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

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

  refreshBills() {
    this.loadBills();
  }

  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AlertController, LoadingController } from '@ionic/angular';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-export',
  templateUrl: './export.page.html',
  styleUrls: ['./export.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonicModule,
    RouterModule,
    FormsModule
  ]
})
export class ExportPage implements OnInit {

  // Date Range
  startDate: string = '';
  endDate: string = '';

  // Selection
  selectAll: boolean = false;
  selectedBills: any[] = [];
  selectedTotalAmount: number = 0;
  showSelectedBills: boolean = false;
  showBillList: boolean = true;

  // Export Options
  selectedFormat: string = 'pdf';
  isExporting = false;
  isLoading = true;
  showExportOptions: boolean = false;

  dateFilters = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'year', label: 'This Year' },
    { id: 'all', label: 'All Time' }
  ];

  allBills: any[] = [];
  filteredBills: any[] = [];

  // ✅ Track selected filter
  currentFilterId: string = 'all';

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {
    console.log('Export page loaded');
  }

  ngOnInit() {
    this.loadBills();
  }

  // ============================================================
  // LOAD BILLS
  // ============================================================

  loadBills() {
    this.isLoading = true;

    this.apiService.getBills().subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.allBills = response.data || [];

          // ✅ Remove duplicates by ID
          const uniqueBills = new Map();
          this.allBills.forEach((bill: any) => {
            if (!uniqueBills.has(bill.id)) {
              uniqueBills.set(bill.id, bill);
            }
          });
          this.allBills = Array.from(uniqueBills.values());

          this.allBills = this.allBills.map((bill: any) => {
            if (typeof bill.items === 'string') {
              try {
                bill.items = JSON.parse(bill.items);
              } catch {
                bill.items = [];
              }
            }

            bill.selected = false;

            bill.total = typeof bill.total === 'string' ? parseFloat(bill.total) : (bill.total || 0);
            bill.subtotal = typeof bill.subtotal === 'string' ? parseFloat(bill.subtotal) : (bill.subtotal || 0);
            bill.tax = typeof bill.tax === 'string' ? parseFloat(bill.tax) : (bill.tax || 0);

            return bill;
          });

          console.log('✅ Bills loaded (unique):', this.allBills.length);

          // ✅ Set default to ALL TIME
          this.currentFilterId = 'all';
          this.applyDateFilter({ id: 'all' });

          console.log('📊 Filtered bills:', this.filteredBills.length);
        }

        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error loading bills:', error);
        this.isLoading = false;
        this.showAlert('Error', 'Could not load bills.');
      }
    });
  }

  // ============================================================
  // DATE HANDLING
  // ============================================================

  onDateChange() {
    this.currentFilterId = 'custom';
    this.applyDateFilterManually();
  }

  applyDateFilterManually() {
    console.log('🔍 Applying manual date filter...');
    
    let filtered = [...this.allBills];

    if (this.startDate && this.endDate) {
      const start = new Date(this.startDate);
      const end = new Date(this.endDate);

      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      console.log('📅 Date range:', start, 'to', end);

      filtered = filtered.filter((bill: any) => {
        const billDate = this.getBillDateObject(bill);
        if (!billDate) {
          console.warn('⚠️ No date for bill:', bill);
          return false;
        }
        const result = billDate >= start && billDate <= end;
        return result;
      });

      console.log(`✅ Filtered to ${filtered.length} bills from ${this.allBills.length}`);
    }

    this.filteredBills = filtered;
    this.updateSelectionState();
  }

  // ============================================================
  // DATE FILTERS - FIXED
  // ============================================================

  applyDateFilter(filter: any) {
    console.log(`🔍 Applying filter: ${filter.id}`);
    this.currentFilterId = filter.id;

    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);

    switch (filter.id) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        console.log('📅 Filter: Today');
        break;

      case 'week':
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        console.log('📅 Filter: This Week (last 7 days)');
        break;

      case 'month':
        start.setMonth(start.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        console.log('📅 Filter: This Month (last 30 days)');
        break;

      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);
        console.log('📅 Filter: This Year (last 365 days)');
        break;

      case 'all':
      default:
        start = new Date(2000, 0, 1);
        start.setHours(0, 0, 0, 0);
        end = new Date(2100, 11, 31);
        end.setHours(23, 59, 59, 999);
        console.log('📅 Filter: All Time');
        break;
    }

    // ✅ Set date values
    this.startDate = this.toDateInputValue(start);
    this.endDate = this.toDateInputValue(end);

    console.log('📅 Start:', this.startDate, 'End:', this.endDate);

    // ✅ Apply filter
    this.applyDateFilterManually();
  }

  // ============================================================
  // GET BILL DATE OBJECT
  // ============================================================

  private getBillDateObject(bill: any): Date | null {
    if (!bill) return null;

    // ✅ Check all possible date fields
    const dateFields = [
      'date',
      'bill_date',
      'billDate',
      'invoice_date',
      'invoiceDate',
      'purchase_date',
      'purchaseDate',
      'transaction_date',
      'transactionDate',
      'document_date',
      'documentDate',
      'issue_date',
      'issueDate',
      'created_at',
      'createdAt',
      'created_date',
      'createdDate'
    ];

    // ✅ Check bill object directly
    for (const field of dateFields) {
      const value = bill[field];
      if (value && String(value).trim() !== '') {
        const parsedDate = this.parseBillDate(value);
        if (parsedDate) {
          console.log(`📅 Found date in bill.${field}: ${value} -> ${parsedDate}`);
          return parsedDate;
        }
      }
    }

    // ✅ Check nested data objects
    const nestedObjects = [bill.data, bill.fields, bill.ocr, bill.invoice, bill.bill];
    for (const object of nestedObjects) {
      if (!object || typeof object !== 'object') continue;
      for (const field of dateFields) {
        const value = object[field];
        if (value && String(value).trim() !== '') {
          const parsedDate = this.parseBillDate(value);
          if (parsedDate) {
            console.log(`📅 Found date in nested.${field}: ${value} -> ${parsedDate}`);
            return parsedDate;
          }
        }
      }
    }

    console.warn('⚠️ No valid date found for bill:', bill);
    return null;
  }

  // ============================================================
  // GET BILL DATE STRING
  // ============================================================

  getBillDate(bill: any): string {
    if (!bill) return 'N/A';
    
    const dateFields = [
      'date', 'bill_date', 'billDate', 'invoice_date', 'invoiceDate',
      'purchase_date', 'purchaseDate', 'transaction_date', 'transactionDate',
      'document_date', 'documentDate', 'issue_date', 'issueDate',
      'created_at', 'createdAt', 'created_date', 'createdDate'
    ];

    // ✅ Check bill object directly
    for (const field of dateFields) {
      const value = bill[field];
      if (value && String(value).trim() !== '') {
        return this.formatDate(value);
      }
    }

    // ✅ Check nested objects
    const nestedObjects = [bill.data, bill.fields, bill.ocr, bill.invoice, bill.bill];
    for (const object of nestedObjects) {
      if (!object || typeof object !== 'object') continue;
      for (const field of dateFields) {
        const value = object[field];
        if (value && String(value).trim() !== '') {
          return this.formatDate(value);
        }
      }
    }

    return 'N/A';
  }

  // ============================================================
  // PARSE BILL DATE
  // ============================================================

  private parseBillDate(value: any): Date | null {
    if (!value) return null;

    const dateString = String(value).trim();
    if (dateString === '') return null;

    // ✅ Try DD/MM/YYYY format (most common in Indian bills)
    let match = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (match) {
      const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      if (!isNaN(date.getTime())) return date;
    }

    // ✅ Try DD-MM-YYYY format
    match = dateString.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (match) {
      const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      if (!isNaN(date.getTime())) return date;
    }

    // ✅ Try DD.MM.YYYY format
    match = dateString.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (match) {
      const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
      if (!isNaN(date.getTime())) return date;
    }

    // ✅ Try YYYY-MM-DD format (ISO)
    match = dateString.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (match) {
      const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
      if (!isNaN(date.getTime())) return date;
    }

    // ✅ Try JavaScript Date parsing
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) return parsed;

    return null;
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  formatDate(value: any): string {
    if (!value) return 'N/A';
    const date = this.parseBillDate(value);
    if (!date) return String(value);
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  formatDateRange(): string {
    if (!this.startDate || !this.endDate) return 'All Time';

    const start = new Date(this.startDate);
    const end = new Date(this.endDate);

    if (start.getFullYear() === 2000 && start.getMonth() === 0 && start.getDate() === 1) {
      return 'All Time';
    }

    return `${this.formatDateInput(start)} - ${this.formatDateInput(end)}`;
  }

  formatDateInput(date: Date): string {
    if (!date || isNaN(date.getTime())) return 'Invalid Date';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private toDateInputValue(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // ============================================================
  // SELECTION
  // ============================================================

  updateSelectionState() {
    const selectedIds = new Set(this.selectedBills.map((b: any) => b.id));

    this.filteredBills.forEach((bill: any) => {
      bill.selected = selectedIds.has(bill.id);
    });

    this.selectAll = this.filteredBills.length > 0 && this.filteredBills.every((bill: any) => bill.selected);

    const filteredIds = new Set(this.filteredBills.map((b: any) => b.id));
    this.selectedBills = this.selectedBills.filter((b: any) => filteredIds.has(b.id));

    this.updateExportOptionsVisibility();
    this.updateSelectedTotal();

    console.log(`📊 Selection updated: ${this.selectedBills.length} bills selected`);
  }

  toggleSelectAll() {
    this.filteredBills.forEach((bill: any) => {
      bill.selected = this.selectAll;
    });

    if (this.selectAll) {
      this.selectedBills = [...this.filteredBills];
    } else {
      this.selectedBills = [];
    }

    this.updateExportOptionsVisibility();
    this.updateSelectedTotal();
  }

  onBillSelect(bill: any) {
    if (bill.selected) {
      if (!this.selectedBills.find(b => b.id === bill.id)) {
        this.selectedBills.push(bill);
      }
    } else {
      this.selectedBills = this.selectedBills.filter(b => b.id !== bill.id);
    }

    this.selectAll = this.filteredBills.length > 0 && this.filteredBills.every((b: any) => b.selected);
    this.updateExportOptionsVisibility();
    this.updateSelectedTotal();
  }

  updateExportOptionsVisibility() {
    this.showExportOptions = this.selectedBills.length > 0;
  }

  updateSelectedTotal() {
    this.selectedTotalAmount = this.selectedBills.reduce((sum, bill) => {
      const total = typeof bill.total === 'string' ? parseFloat(bill.total) : (bill.total || 0);
      return sum + total;
    }, 0);
  }

  // ============================================================
  // CURRENCY
  // ============================================================

  formatCurrency(amount: number): string {
    if (!amount && amount !== 0) return '₹0';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(numAmount);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  async exportBills() {
    if (this.selectedBills.length === 0) {
      this.showAlert('No Data', 'No bills selected to export.');
      return;
    }

    this.isExporting = true;

    try {
      if (this.selectedFormat === 'pdf') {
        await this.exportPDF();
      } else if (this.selectedFormat === 'excel') {
        await this.exportExcel();
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showAlert('Error', 'Failed to export. Please try again.');
    } finally {
      this.isExporting = false;
    }
  }

  // ============================================================
  // PDF EXPORT
  // ============================================================

  async exportPDF() {
    try {
      const loading = await this.showLoading('Generating PDF...');

      const doc = new jsPDF('l', 'mm', 'a4');
      doc.setFontSize(18);
      doc.text('Bills Export Report', 14, 22);
      doc.setFontSize(11);
      doc.text(`Date Range: ${this.formatDateRange()}`, 14, 32);
      doc.text(`Total Bills: ${this.selectedBills.length}`, 14, 38);
      doc.text(`Total Amount: ${this.formatCurrency(this.selectedTotalAmount)}`, 14, 44);

      const tableData = this.selectedBills.map((bill: any) => {
        return [
          bill.bill_number || 'N/A',
          bill.vendor || 'Unknown',
          this.getBillDate(bill),
          this.formatCurrency(bill.subtotal || 0),
          this.formatCurrency(bill.tax || 0),
          this.formatCurrency(bill.total || 0),
          bill.gstin || 'N/A'
        ];
      });

      autoTable(doc, {
        head: [['Bill Number', 'Vendor', 'Date', 'Subtotal', 'Tax', 'Total', 'GSTIN']],
        body: tableData,
        startY: 50,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontSize: 10,
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 28 },
          3: { cellWidth: 25 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 30 }
        }
      });

      doc.save('bills_export.pdf');
      loading.dismiss();
      this.showAlert('Success', `PDF exported successfully!\n\n${this.selectedBills.length} bills exported.`);
    } catch (error) {
      console.error('PDF Export error:', error);
      throw error;
    }
  }

  // ============================================================
  // EXCEL EXPORT
  // ============================================================

  async exportExcel() {
    try {
      const loading = await this.showLoading('Generating Excel file...');

      let content = 'Bill Number,Vendor,Date,Subtotal,Tax,Total,GSTIN\n';

      this.selectedBills.forEach((bill: any) => {
        const formattedDate = this.getBillDate(bill);
        const escapeField = (field: any) => {
          if (field === null || field === undefined) return '';
          const str = String(field);
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        };

        content += [
          escapeField(bill.bill_number || 'N/A'),
          escapeField(bill.vendor || 'Unknown'),
          escapeField(formattedDate),
          bill.subtotal || 0,
          bill.tax || 0,
          bill.total || 0,
          escapeField(bill.gstin || 'N/A')
        ].join(',') + '\n';
      });

      const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'bills_export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      loading.dismiss();
      this.showAlert('Success', `Excel file exported successfully!\n\n${this.selectedBills.length} bills exported.`);
    } catch (error) {
      console.error('Excel Export error:', error);
      throw error;
    }
  }

  // ============================================================
  // LOADING
  // ============================================================

  async showLoading(message: string) {
    const loading = await this.loadingController.create({
      message: message,
      duration: 3000
    });
    await loading.present();
    return loading;
  }

  // ============================================================
  // ALERT
  // ============================================================

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  goToUpload() {
    this.router.navigateByUrl('/upload');
  }
}
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AlertController, ToastController } from '@ionic/angular';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Component({
  selector: 'app-bill-detail',
  templateUrl: './bill-detail.page.html',
  styleUrls: ['./bill-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class BillDetailPage implements OnInit {
  billId: number = 0;
  bill: any = null;
  isLoading: boolean = true;
  showFullImage: boolean = false;
  isDarkMode: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController,
    private toastController: ToastController
  ) {
    console.log('✅ Bill detail page loaded!');
    
    const savedTheme = localStorage.getItem('app-theme');
    this.isDarkMode = savedTheme === 'dark';
  }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.billId = params['id'];
      console.log('📋 Bill ID:', this.billId);
      this.loadBillDetails();
    });
  }

  loadBillDetails() {
    this.isLoading = true;
    
    this.apiService.getBill(this.billId).subscribe({
      next: (response: any) => {
        console.log('📋 Bill details:', response);
        if (response && response.success) {
          this.bill = response.data;
          
          if (typeof this.bill.items === 'string') {
            try {
              this.bill.items = JSON.parse(this.bill.items);
            } catch {
              this.bill.items = [];
            }
          }
          
          if (!this.bill.subtotal && this.bill.items) {
            this.bill.subtotal = this.bill.items.reduce(
              (sum: number, item: any) => sum + (item.price * item.qty), 0
            );
          }
          if (!this.bill.tax && this.bill.subtotal) {
            this.bill.tax = this.bill.subtotal * 0.18;
          }
          if (!this.bill.total && this.bill.subtotal && this.bill.tax) {
            this.bill.total = this.bill.subtotal + this.bill.tax;
          }
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading bill:', error);
        this.isLoading = false;
        this.showAlert('Error', 'Could not load bill details.');
        this.router.navigateByUrl('/bills');
      }
    });
  }

  // ----- ITEM CALCULATIONS -----
  getItemTotal(item: any): number {
    return (item.price || 0) * (item.qty || 1);
  }

  getSubtotal(): number {
    if (this.bill?.subtotal) return this.bill.subtotal;
    if (this.bill?.items) {
      return this.bill.items.reduce(
        (sum: number, item: any) => sum + this.getItemTotal(item), 0
      );
    }
    return 0;
  }

  getTax(): number {
    if (this.bill?.tax) return this.bill.tax;
    return this.getSubtotal() * 0.18;
  }

  getTotal(): number {
    if (this.bill?.total) return this.bill.total;
    return this.getSubtotal() + this.getTax();
  }

  // ----- EXPORT AS PDF (FIXED) -----
  async exportPDF() {
    if (!this.bill) {
      this.showAlert('Error', 'No bill data to export.');
      return;
    }

    try {
      const loading = await this.showLoading('Generating PDF...');
      
      // Generate PDF
      this.generatePDF();
      
      loading.dismiss();
      this.showToast('PDF exported successfully!', 'success');
      
    } catch (error) {
      console.error('PDF Export error:', error);
      this.showAlert('Error', 'Failed to generate PDF. Please try again.');
    }
  }

  generatePDF() {
    // Create new PDF document
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - (margin * 2);
    
    let yPos = 20;

    // ----- HEADER SECTION -----
    // Title
    doc.setFontSize(24);
    doc.setTextColor('#667eea');
    doc.setFont('helvetica', 'bold');
    doc.text('BILL DETAILS', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Divider Line
    doc.setDrawColor('#667eea');
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;

    // ----- BILL INFORMATION -----
    doc.setFontSize(10);
    doc.setTextColor('#666666');
    doc.setFont('helvetica', 'normal');
    
    // Bill Number
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#333333');
    doc.text('Bill Number:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000000');
    doc.text(this.bill.bill_number || 'N/A', margin + 40, yPos);
    yPos += 7;

    // Vendor
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#333333');
    doc.text('Vendor:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000000');
    doc.text(this.bill.vendor || 'N/A', margin + 40, yPos);
    yPos += 7;

    // Date
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#333333');
    doc.text('Date:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#000000');
    doc.text(this.formatDate(this.bill.date || this.bill.created_at), margin + 40, yPos);
    yPos += 7;

    // GSTIN
    if (this.bill.gstin) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor('#333333');
      doc.text('GSTIN:', margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor('#000000');
      doc.text(this.bill.gstin, margin + 40, yPos);
      yPos += 7;
    }

    yPos += 8;

    // ----- ITEMS TABLE -----
    if (this.bill.items && this.bill.items.length > 0) {
      // Table Headers
      const headers = ['#', 'Item Description', 'Qty', 'Price', 'Amount'];
      
      // Table Data
      const data = this.bill.items.map((item: any, index: number) => [
        (index + 1).toString(),
        item.name || 'Item',
        (item.qty || 1).toString(),
        '₹' + Number(item.price || 0).toLocaleString('en-IN'),
        '₹' + Number(this.getItemTotal(item)).toLocaleString('en-IN')
      ]);

      // Generate Table
      autoTable(doc, {
        startY: yPos,
        head: [headers],
        body: data,
        theme: 'striped',
        headStyles: {
          fillColor: '#667eea',
          textColor: '#ffffff',
          fontStyle: 'bold',
          fontSize: 9,
          halign: 'center'
        },
        bodyStyles: {
          fontSize: 9,
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 70, halign: 'left' },
          2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 35, halign: 'right' }
        },
        margin: { left: margin, right: margin },
        tableWidth: contentWidth
      });

      // Get final Y position after table
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      yPos = finalY;

    } else {
      // No items message
      doc.setFontSize(11);
      doc.setTextColor('#999999');
      doc.text('No items in this bill.', margin, yPos);
      yPos += 15;
    }

    // ----- SUMMARY SECTION -----
    const subtotal = this.getSubtotal();
    const tax = this.getTax();
    const total = this.getTotal();

    // Align summary to the right
    const summaryX = pageWidth - margin - 60;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#666666');
    doc.text('Subtotal:', summaryX, yPos);
    doc.setTextColor('#000000');
    doc.text('₹' + Number(subtotal).toLocaleString('en-IN'), pageWidth - margin, yPos);
    yPos += 7;

    doc.setTextColor('#666666');
    doc.text('Tax (18%):', summaryX, yPos);
    doc.setTextColor('#000000');
    doc.text('₹' + Number(tax).toLocaleString('en-IN'), pageWidth - margin, yPos);
    yPos += 7;

    // Total with emphasis
    doc.setDrawColor('#4CAF50');
    doc.setLineWidth(0.3);
    doc.line(summaryX, yPos - 2, pageWidth - margin, yPos - 2);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor('#4CAF50');
    doc.text('TOTAL:', summaryX, yPos + 2);
    doc.setTextColor('#4CAF50');
    doc.text('₹' + Number(total).toLocaleString('en-IN'), pageWidth - margin, yPos + 2);
    yPos += 14;

    // ----- ADDITIONAL INFO -----
    if (this.bill.amount_words) {
      yPos += 4;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor('#666666');
      doc.text('Amount in Words:', margin, yPos);
      doc.setTextColor('#000000');
      doc.text(this.bill.amount_words, margin + 35, yPos);
      yPos += 8;
    }

    if (this.bill.payment_terms) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor('#666666');
      doc.text('Payment Terms:', margin, yPos);
      doc.setTextColor('#000000');
      doc.text(this.bill.payment_terms, margin + 35, yPos);
      yPos += 8;
    }

    // ----- FOOTER -----
    yPos += 10;
    doc.setDrawColor('#cccccc');
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor('#999999');
    doc.text('Generated by Bill Scanner App', pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
    doc.text('© ' + new Date().getFullYear() + ' Bill Scanner - All Rights Reserved', pageWidth / 2, yPos, { align: 'center' });

    // ----- SAVE PDF -----
    const filename = `bill_${this.bill.bill_number || this.billId || 'export'}.pdf`;
    doc.save(filename);
  }

  // ----- ACTIONS -----
  async deleteBill() {
    const alert = await this.alertController.create({
      header: 'Delete Bill',
      message: 'Are you sure you want to delete this bill? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: () => {
            this.apiService.deleteBill(this.billId).subscribe({
              next: () => {
                console.log('✅ Bill deleted');
                this.showToast('Bill deleted successfully!', 'success');
                this.router.navigateByUrl('/bills');
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

  async editBill() {
    this.router.navigate(['/validation'], {
      state: { 
        billData: this.bill,
        isEditing: true
      }
    });
  }

  // ----- UI HELPERS -----
  toggleFullImage() {
    this.showFullImage = !this.showFullImage;
  }

  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  getStatusColor(): string {
    if (this.bill?.status === 'paid') return 'success';
    if (this.bill?.status === 'pending') return 'warning';
    return 'medium';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return 'No date';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'bottom'
    });
    await toast.present();
  }

  async showLoading(message: string) {
    const loading = await this.alertController.create({
      header: 'Please wait',
      message: message,
      buttons: ['Cancel']
    });
    await loading.present();
    return loading;
  }

  delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  goBack() {
    this.router.navigateByUrl('/bills');
  }
}
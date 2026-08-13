import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class DashboardPage {
  recentBills = [
    { id: 1, vendor: 'ABC Store', date: '2024-01-15', total: 99.90 },
    { id: 2, vendor: 'XYZ Mart', date: '2024-01-14', total: 45.50 }
  ];

  constructor(private router: Router) {
    console.log('✅ Dashboard created!');
  }

  // SIMPLE navigation - using Router
  goToUpload() {
    console.log('🟢 Navigating to upload...');
    this.router.navigateByUrl('/upload').then(
      (success) => {
        console.log('✅ Navigation success:', success);
      },
      (error) => {
        console.error('❌ Navigation error:', error);
        alert('Error navigating to upload page. Please check console.');
      }
    );
  }

  goToBills() {
    console.log('🟢 Navigating to bills...');
    this.router.navigateByUrl('/bills').then(
      (success) => {
        console.log('✅ Navigation success:', success);
      },
      (error) => {
        console.error('❌ Navigation error:', error);
      }
    );
  }

  viewBill(id: number) {
    console.log('🟢 Viewing bill:', id);
    this.router.navigateByUrl(`/bill-detail/${id}`);
  }
}
// src/app/bills/bills.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-bills',
  templateUrl: './bills.page.html',
  styleUrls: ['./bills.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class BillsPage implements OnInit {
  bills = [
    { id: 1, vendor: 'ABC Store', date: '2024-01-15', total: 99.90, billNumber: 'INV-001' },
    { id: 2, vendor: 'XYZ Mart', date: '2024-01-14', total: 45.50, billNumber: 'INV-002' },
    { id: 3, vendor: 'Corner Shop', date: '2024-01-13', total: 23.75, billNumber: 'INV-003' },
    { id: 4, vendor: 'Super Market', date: '2024-01-12', total: 156.20, billNumber: 'INV-004' }
  ];

  constructor(private router: Router) {
    console.log('✅ BillsPage loaded');
  }

  ngOnInit() {}

  viewBill(id: number) {
    console.log('Viewing bill:', id);
    this.router.navigate(['/bill-detail', id]);
  }

  goToUpload() {
    this.router.navigate(['/upload']);
  }
}
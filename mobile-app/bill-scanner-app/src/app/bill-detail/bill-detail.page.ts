// src/app/bill-detail/bill-detail.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-bill-detail',
  templateUrl: './bill-detail.page.html',
  styleUrls: ['./bill-detail.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class BillDetailPage implements OnInit {
  billId: number = 0;
  
  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.billId = params['id'];
      console.log('Bill ID:', this.billId);
    });
  }
}
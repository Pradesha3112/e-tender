import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';

@Component({
  selector: 'app-validation',
  templateUrl: './validation.page.html',
  styleUrls: ['./validation.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule]
})
export class ValidationPage implements OnInit {
  billData: any = {};
  isEditing = false;
  editData: any = {};  // ← DECLARED ONLY ONCE HERE

  constructor(private router: Router) {
    console.log('✅ VALIDATION PAGE LOADED!');
    
    const navigation = this.router.getCurrentNavigation();
    if (navigation?.extras?.state) {
      this.billData = navigation.extras.state['billData'];
      this.editData = { ...this.billData }; // Copy for editing
      console.log('📋 Bill data received:', this.billData);
    } else {
      // Fallback dummy data
      this.billData = {
        bill_number: 'INV-2024-001',
        vendor: 'TechMart Solutions Pvt. Ltd.',
        date: '2024-01-15',
        subtotal: 24500,
        tax: 4410,
        total: 28730,
        items: [
          { name: 'Dell 24 Monitor', qty: 2, price: 9500 },
          { name: 'Logitech Keyboard', qty: 2, price: 950 },
          { name: 'Logitech Mouse', qty: 2, price: 550 }
        ]
      };
      this.editData = { ...this.billData };
    }
  }

  ngOnInit() {}

  confirmBill() {
    console.log('✅ Bill confirmed!', this.billData);
    alert('💾 Bill saved successfully! 🎉');
    this.router.navigateByUrl('/bills');
  }

  retakePhoto() {
    console.log('📸 Retaking photo...');
    this.router.navigateByUrl('/upload');
  }

  toggleEdit() {
    this.isEditing = !this.isEditing;
    if (this.isEditing) {
      console.log('✏️ Edit mode enabled');
      // Copy current data to edit
      this.editData = { ...this.billData };
    } else {
      // Save edits
      this.billData = { ...this.editData };
      console.log('✅ Data updated:', this.billData);
    }
  }

  updateField(field: string, value: any) {
    this.editData[field] = value;
  }

  // Add this method to save edited data
  saveEdits() {
    this.billData = { ...this.editData };
    this.isEditing = false;
    console.log('✅ Data saved:', this.billData);
    alert('✅ Data updated successfully!');
  }
}
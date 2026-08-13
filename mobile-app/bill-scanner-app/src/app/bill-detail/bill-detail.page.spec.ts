import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BillDetailPage } from './bill-detail.page';

describe('BillDetailPage', () => {
  let component: BillDetailPage;
  let fixture: ComponentFixture<BillDetailPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BillDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

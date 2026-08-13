import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ValidationPage } from './validation.page';

describe('ValidationPage', () => {
  let component: ValidationPage;
  let fixture: ComponentFixture<ValidationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(ValidationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

// src/app/services/api.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'  // This makes it available everywhere
})
export class ApiService {
  // For browser testing
  private apiUrl = 'http://localhost:5000';
  
  // For mobile testing - change to your computer's IP
  // private apiUrl = 'http://192.168.1.100:5000';

  constructor(private http: HttpClient) {}

  uploadBill(imageData: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/upload`, {
      image: imageData
    });
  }

  saveBill(billData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/save`, billData);
  }

  getBills(): Observable<any> {
    return this.http.get(`${this.apiUrl}/bills`);
  }

  getBill(id: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/bills/${id}`);
  }

  deleteBill(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/bills/${id}`);
  }
}
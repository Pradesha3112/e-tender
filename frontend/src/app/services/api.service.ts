import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // 🔴 CHANGE THIS TO YOUR CORRECT IP
  //private apiUrl = 'http://192.168.58.153:5000';  // ← USE YOUR FLASK IP
  
  // For local testing (browser):
  private apiUrl = 'http://localhost:5000';

  constructor(private http: HttpClient) {
    console.log('✅ API Service created with URL:', this.apiUrl);
  }

  uploadBill(imageData: string): Observable<any> {
    console.log('📤 Uploading to:', `${this.apiUrl}/upload`);
    return this.http.post(`${this.apiUrl}/upload`, { image: imageData });
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

  getStats(): Observable<any> {
    return this.http.get(`${this.apiUrl}/stats`);
  }
}
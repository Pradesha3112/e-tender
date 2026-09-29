// ============================================================
// FILE: src/app/services/api.service.ts
// PURPOSE: Central HTTP service — auto-attaches JWT, handles 401
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  // 🔴 CHANGE THIS if backend runs elsewhere
  private apiUrl = 'http://localhost:5000';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
  ) {
    console.log('✅ API Service created with URL:', this.apiUrl);
  }

  // ============================================================
  // HEADERS — auto-attach Bearer token
  // ============================================================
  private headers(): HttpHeaders {
    const token = this.auth.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    });
  }

  private handleError = (err: HttpErrorResponse) => {
    if (err.status === 401) {
      console.warn('🔒 401 Unauthorized — logging out');
      this.auth.forceLogout();
    }
    return throwError(() => err);
  };

  // ============================================================
  // PUBLIC — verify credentials (no token needed)
  // ============================================================
  verifyCredentials(username: string, password: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/login`,
      { username, password }
    );
  }

  // ============================================================
  // BILLS
  // ============================================================
  uploadBill(imageData: string): Observable<any> {
    console.log('📤 Uploading to:', `${this.apiUrl}/upload`);
    return this.http.post(
      `${this.apiUrl}/upload`,
      { image: imageData },
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  saveBill(billData: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/save`,
      billData,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getBills(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/bills`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getBill(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/bills/${id}`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  deleteBill(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/bills/${id}`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getStats(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/stats`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }
    // ============================================================
  // DASHBOARD — Notices & Activity
  // ============================================================
  getNotices(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/notices`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getActivity(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/activity`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getCategories(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/categories`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  // ============================================================
  // USERS
  // ============================================================
  getUsers(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/users`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  createUser(payload: any): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/users`,
      payload,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  updateUser(id: number, payload: any): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/users/${id}`,
      payload,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  toggleUser(id: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/users/${id}/toggle`,
      {},
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/users/${id}`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }
}
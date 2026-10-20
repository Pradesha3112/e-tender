// ============================================================
// FILE: src/app/services/api.service.ts
// PURPOSE: HTTP service — auto-Bearer + 401 + soft delete
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
export class ApiService {private apiUrl = 'http://192.168.43.84:5000';

  constructor(
    private http: HttpClient,
    private auth: AuthService,
    private router: Router,
  ) {
    console.log('✅ API Service created with URL:', this.apiUrl);
  }

  // ============================================================
  // HEADERS
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
  // PUBLIC
  // ============================================================
  verifyCredentials(username: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { username, password });
  }

  // ============================================================
  // BILLS
  // ============================================================
  uploadBill(imageData: string): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/upload`,
      { image: imageData },
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }
    /**
   * Send either { image } or { pdf } to /upload.
   * Used by the Upload page for both file types.
   */
  uploadBillPayload(payload: { image?: string; pdf?: string }): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/upload`,
      payload,
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

  /** Active bills only (soft-deleted excluded) */
  getBills(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/bills`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  /** NEW — Recycle bin: soft-deleted bills */
  getDeletedBills(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/bills/deleted`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  getBill(id: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/bills/${id}`,
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }


    /**
   * Soft delete — moves bill to recycle bin.
   * @param id     bill ID
   * @param reason required for super_admin and clerk; ignored for admin
   */
  deleteBill(id: number, reason?: string): Observable<any> {
    const body = reason ? { reason } : {};
    return this.http.request('DELETE', `${this.apiUrl}/bills/${id}`, {
      headers: this.headers(),
      body,
    }).pipe(catchError(this.handleError));
  }

  /** NEW — Restore a soft-deleted bill (admin only) */
  restoreBill(id: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/bills/${id}/restore`,
      {},
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  /** NEW — Permanently delete a soft-deleted bill (admin only) */
  hardDeleteBill(id: number): Observable<any> {
    return this.http.delete(
      `${this.apiUrl}/bills/${id}/hard`,
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
  // DASHBOARD
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
    /**
   * Logout — marks current user's activity session as closed.
   * Called before clearing local storage.
   */
  logout(): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/logout`,
      {},
      { headers: this.headers() }
    ).pipe(catchError(this.handleError));
  }

  /**
   * Get recent user login/logout activity.
   * - admin / super_admin → all users
   * - clerk               → own only
   */
  getUserActivity(): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/user-activity`,
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
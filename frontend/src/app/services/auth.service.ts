// ============================================================
// FILE: src/app/services/auth.service.ts
// PURPOSE: Central auth service (JWT + user state)
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Router } from '@angular/router';

// ------------------------------------------------------------
// TYPES
// ------------------------------------------------------------
export type Role = 'admin' | 'super_admin' | 'clerk';

export interface AuthUser {
  id?: number;
  username: string;
  full_name: string;
  role: Role;
  category_group: 'all' | 'adfm_1' | 'adfm_2';
  designation?: string;
}

export interface LoginResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
  error?: string;
}

export interface CategoryPayload {
  group: 'all' | 'adfm_1' | 'adfm_2';
  label: string;
  categories: string[];
  allow_all: boolean;
}

// ------------------------------------------------------------
// SERVICE
// ------------------------------------------------------------
@Injectable({ providedIn: 'root' })
export class AuthService {

  // 👇 Change this if your backend runs elsewhere
  private readonly API = 'http://localhost:5000';

  private readonly TOKEN_KEY = 'rly_token';
  private readonly USER_KEY  = 'rly_user';

  // Reactive current-user stream
  private currentUserSubject = new BehaviorSubject<AuthUser | null>(this.loadUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  // ============================================================
  // LOGIN / LOGOUT
  // ============================================================
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API}/login`, { username, password })
      .pipe(
        tap(res => {
          if (res.success && res.token && res.user) {
            this.setSession(res.token, res.user);
          }
        }),
        catchError(err => {
          const msg = err?.error?.error || 'Login failed';
          return of({ success: false, error: msg } as LoginResponse);
        })
      );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // ============================================================
  // SESSION STORAGE
  // ============================================================
  private setSession(token: string, user: AuthUser): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  private loadUserFromStorage(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) as AuthUser : null;
    } catch {
      return null;
    }
  }

  // ============================================================
  // GETTERS
  // ============================================================
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUserSubject.value;
  }

  isLoggedIn(): boolean {
    return !!this.getToken() && !!this.getCurrentUser();
  }

  getRole(): Role | null {
    return this.getCurrentUser()?.role ?? null;
  }

  getCategoryGroup(): 'all' | 'adfm_1' | 'adfm_2' | null {
    return this.getCurrentUser()?.category_group ?? null;
  }

  // ============================================================
  // ROLE CHECKS
  // ============================================================
  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  isSuperAdmin(): boolean {
    return this.getRole() === 'super_admin';
  }

  isClerk(): boolean {
    return this.getRole() === 'clerk';
  }

  hasRole(...roles: Role[]): boolean {
    const r = this.getRole();
    return !!r && roles.includes(r);
  }

  /** Can this user open the User Management page? */
  canManageUsers(): boolean {
    return this.hasRole('admin', 'super_admin');
  }

  /** Can this user create other users? */
  canCreateUsers(): boolean {
    return this.hasRole('admin', 'super_admin');
  }

  /** Can this user create a specific role? */
  canCreateRole(target: Role): boolean {
    const me = this.getRole();
    if (me === 'admin')       return target === 'super_admin' || target === 'clerk';
    if (me === 'super_admin') return target === 'clerk';
    return false;
  }

  /** Can this user manage (edit/activate/delete) a specific user? */
  canManageUser(targetRole: Role): boolean {
    const me = this.getRole();
    if (targetRole === 'admin') return false;                    // admin is untouchable
    if (me === 'admin')       return targetRole === 'super_admin' || targetRole === 'clerk';
    if (me === 'super_admin') return targetRole === 'clerk';
    return false;
  }

  /** Can this user edit/delete a specific bill? */
  canEditBill(bill: any): boolean {
    const me = this.getCurrentUser();
    if (!me) return false;
    if (me.role === 'admin') return true;
    if (me.role === 'super_admin') {
      return bill?.category_group === me.category_group;
    }
    if (me.role === 'clerk') {
      return bill?.created_by === me.username;
    }
    return false;
  }

  // ============================================================
  // HTTP HEADERS HELPER
  // ============================================================
  authHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    });
  }

  // ============================================================
  // FORCE LOGOUT (e.g. on 401)
  // ============================================================
  forceLogout(): void {
    this.logout();
  }
}
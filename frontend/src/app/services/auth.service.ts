// ============================================================
// FILE: src/app/services/auth.service.ts
// PURPOSE: Central auth service (JWT + user state + recycle + multi-session)
// ============================================================
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, of, firstValueFrom } from 'rxjs';
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
  session_id?: string; // <-- Added for unique session tracking
  user?: AuthUser;
  error?: string;
}

// ------------------------------------------------------------
// SERVICE
// ------------------------------------------------------------
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://192.168.43.84:5000';
  private readonly TOKEN_KEY = 'rly_token';
  private readonly USER_KEY  = 'rly_user';
  private readonly SESSION_KEY = 'rly_session_id'; // <-- Added for unique session tracking
  private readonly LOGIN_TIME_KEY = 'rly_login_time';
  
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
          // Ensure we receive the session_id from the updated backend
          if (res.success && res.token && res.user && res.session_id) {
            this.setSession(res.token, res.user, res.session_id);
            localStorage.setItem(this.LOGIN_TIME_KEY, new Date().toISOString());
          }
        }),
        catchError(err => {
          const msg = err?.error?.error || 'Login failed';
          return of({ success: false, error: msg } as LoginResponse);
        })
      );
  }

  async logout(): Promise<void> {
    try {
      const token = this.getToken();
      const sessionId = this.getSessionId();

      if (token && sessionId) {
        // Send the specific session_id to the backend to close only this session
        await firstValueFrom(
          this.http.post(
            `${this.API}/logout`,
            { session_id: sessionId },
            {
              headers: new HttpHeaders({
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              }),
            }
          )
        ).catch(() => {
          console.warn('⚠️ Logout API failed (non-fatal)');
        });
      }
    } catch (err) {
      console.warn('⚠️ Logout API error (non-fatal):', err);
    }

    // Clear local storage
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.LOGIN_TIME_KEY);
    this.currentUserSubject.next(null);

    // Navigate to login
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }

  // ============================================================
  // SESSION
  // ============================================================
  private setSession(token: string, user: AuthUser, sessionId: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.SESSION_KEY, sessionId);
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

  getSessionId(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
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

  /** Get the timestamp when the current user logged in */
  getLoginTime(): string | null {
    return localStorage.getItem(this.LOGIN_TIME_KEY);
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

  canManageUsers(): boolean {
    return this.hasRole('admin', 'super_admin');
  }

  canCreateUsers(): boolean {
    return this.hasRole('admin', 'super_admin');
  }

  canCreateRole(target: Role): boolean {
    const me = this.getRole();
    if (me === 'admin')       return target === 'super_admin' || target === 'clerk';
    if (me === 'super_admin') return target === 'clerk';
    return false;
  }

  canManageUser(targetRole: Role): boolean {
    const me = this.getRole();
    if (targetRole === 'admin') return false;
    if (me === 'admin')       return targetRole === 'super_admin' || targetRole === 'clerk';
    if (me === 'super_admin') return targetRole === 'clerk';
    return false;
  }

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
  // RECYCLE BIN PERMISSIONS
  // ============================================================
  /** Can this user see the Recycle Bin menu? */
  canViewRecycleBin(): boolean {
    return this.isLoggedIn();
  }

  /** Can this user restore deleted bills? Admin only */
  canRestoreBill(): boolean {
    return this.isAdmin();
  }

  /** Can this user permanently delete bills? Admin only */
  canHardDeleteBill(): boolean {
    return this.isAdmin();
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
  // FORCE LOGOUT
  // ============================================================
  forceLogout(): void {
    this.logout();
  }
}
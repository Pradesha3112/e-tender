// ============================================================
// FILE: src/app/guards/role.guard.ts
// PURPOSE: Restrict routes based on user role
// ============================================================

import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, UrlTree } from '@angular/router';
import { AuthService, Role } from '../services/auth.service';

@Injectable({ providedIn: 'root' })
export class RoleGuard implements CanActivate {

  constructor(private auth: AuthService, private router: Router) {}

  canActivate(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const required: Role[] = (route.data?.['roles'] as Role[]) || [];

    // If no roles listed, no restriction
    if (required.length === 0) return true;

    const user = this.auth.getCurrentUser();
    if (!user) {
      return this.router.createUrlTree(['/login']);
    }

    if (required.includes(user.role)) {
      return true;
    }

    // Not allowed — send to dashboard (or a "not authorized" page)
    return this.router.createUrlTree(['/dashboard']);
  }
}
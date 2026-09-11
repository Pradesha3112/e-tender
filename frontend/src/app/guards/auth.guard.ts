import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  canActivate(): boolean | UrlTree {

    const isLoggedIn =
      localStorage.getItem('isLoggedIn') === 'true' ||
      !!localStorage.getItem('authToken') ||
      !!localStorage.getItem('token');

    if (isLoggedIn) {
      console.log('✅ AuthGuard: User authenticated');
      return true;
    }

    console.warn('❌ AuthGuard: User not authenticated');

    return this.router.createUrlTree(['/login']);
  }
}
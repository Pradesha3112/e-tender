import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-shell',
  templateUrl: './shell.component.html',
  styleUrls: ['./shell.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule],
})
export class AppShellComponent implements OnInit, OnDestroy {

  // ----- INPUTS (per page) -----
  @Input() pageTitle = '';                       // e.g. "Bills"
  @Input() showBack = false;                     // show back arrow
  @Input() backHref = '/dashboard';              // where back goes
  @Input() showRightPanel = false;               // dashboard only
  @Input() showRecycleBin = true;                // sidebar link
  @Input() showUsers = true;                     // sidebar link
  @Input() showExport = true;                    // sidebar link
  // ----- STATE -----
  sidebarCollapsed = false;                      // desktop toggle
  sidebarDrawerOpen = false;                     // mobile drawer
  rightPanelOpen = true;                         // dashboard right panel
  isRefreshing = false;                          // refresh animation flag

  // ----- OUTPUTS -----
  @Output() refresh = new EventEmitter<void>();
  private navSub?: Subscription;

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    // Restore saved sidebar state on desktop
    const saved = localStorage.getItem('rly_sidebar_collapsed');
    if (saved === '1') this.sidebarCollapsed = true;

    // Restore right panel state
    const rightSaved = localStorage.getItem('rly_right_panel_open');
    if (rightSaved === '0') this.rightPanelOpen = false;

    // Auto-close mobile drawer on navigation
    this.navSub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => {
        this.sidebarDrawerOpen = false;
      });
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  // ============================================================
  // USER / ROLE HELPERS
  // ============================================================
  get user() {
    return this.auth.getCurrentUser();
  }

  get roleLabel(): string {
    const r = this.auth.getRole();
    if (r === 'admin')       return 'Sr. DRM';
    if (r === 'super_admin') {
      return this.auth.getCategoryGroup() === 'adfm_1'
        ? 'ADRM I/MDU'
        : 'ADRM II/MDU';
    }
    if (r === 'clerk')       return 'SSO';
    return '—';
  }

  get canManageUsers(): boolean {
    return this.auth.canManageUsers();
  }

  get canAccessAdminPasswords(): boolean {
    return this.auth.isAdmin();
  }

  // ============================================================
  // SIDEBAR CONTROLS
  // ============================================================
  toggleSidebar(): void {
    // On mobile (<768px): toggle drawer
    if (window.innerWidth < 768) {
      this.sidebarDrawerOpen = !this.sidebarDrawerOpen;
    } else {
      // On desktop: toggle collapse
      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem(
        'rly_sidebar_collapsed',
        this.sidebarCollapsed ? '1' : '0'
      );
    }
  }

  closeDrawer(): void {
    this.sidebarDrawerOpen = false;
  }

  toggleRightPanel(): void {
    this.rightPanelOpen = !this.rightPanelOpen;
    localStorage.setItem(
      'rly_right_panel_open',
      this.rightPanelOpen ? '1' : '0'
    );
  }

  // ============================================================
  // REFRESH
  // ============================================================
  onRefreshClick(): void {
    if (this.isRefreshing) return;

    // Spin animation
    this.isRefreshing = true;
    setTimeout(() => { this.isRefreshing = false; }, 600);

    // Notify parent page
    this.refresh.emit();
  }

  // ============================================================
  // NAVIGATION HELPERS
  // ============================================================
  isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  goBack(): void {
    this.router.navigateByUrl(this.backHref);
  }

  // ============================================================
  // NAVIGATION ACTIONS
  // ============================================================
  goToDashboard()    { this.router.navigateByUrl('/dashboard'); }
  goToUpload()       { this.router.navigateByUrl('/upload'); }
  goToBills()        { this.router.navigateByUrl('/bills'); }
  goToExport()       { this.router.navigateByUrl('/export'); }
  goToUsers()        { this.router.navigateByUrl('/users'); }
  goToProfile()      { this.router.navigateByUrl('/profile'); }
  goToRecycleBin()   { this.router.navigateByUrl('/recycle-bin'); }
  goToAdminPasswords() { this.router.navigateByUrl('/admin-passwords'); }
}
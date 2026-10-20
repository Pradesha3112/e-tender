// ============================================================
// FILE: src/app/bills/bills.page.ts
// PURPOSE: Bills list with smart date filter + inline calendar
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';
import { AppShellComponent } from '../shared/shell/shell.component';

@Component({
  selector: 'app-bills',
  templateUrl: './bills.page.html',
  styleUrls: ['./bills.page.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, RouterModule, FormsModule, AppShellComponent],
})
export class BillsPage implements OnInit, OnDestroy {

  allBills: any[] = [];
  filteredBills: any[] = [];
  isLoading = true;
  searchTerm = '';

  // Date range (free text — may be year / month / day / full date)
  startDate = '';
  endDate   = '';

  // Quick range
  quickRanges = [
    { id: 'today',  label: 'Today',      icon: 'today-outline' },
    { id: 'week',   label: 'This Week',  icon: 'calendar-number-outline' },
    { id: 'month',  label: 'This Month', icon: 'calendar-outline' },
    { id: 'year',   label: 'This Year',  icon: 'calendar-clear-outline' },
    { id: 'clear',  label: 'Clear',      icon: 'close-circle-outline' },
  ];
  activeQuickRange = '';

  // Inline calendar state
  showCalendarFor: 'start' | 'end' | '' = '';
  weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Calendar view month/year (per field)
  private calView: { start: { y: number; m: number }, end: { y: number; m: number } } = {
    start: { y: new Date().getFullYear(), m: new Date().getMonth() },
    end:   { y: new Date().getFullYear(), m: new Date().getMonth() },
  };

  // Debounce for live search
  private searchDebounce: any = null;

  stats = { totalAmount: 0 };

  constructor(
    private router: Router,
    private apiService: ApiService,
    private alertController: AlertController,
    private toastController: ToastController,
    public auth: AuthService,
  ) {
    console.log('✅ BILLS PAGE LOADED!');
  }

  ngOnInit() {
    this.loadBills();
  }

  ngOnDestroy() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
  }

  // ============================================================
  // LOAD
  // ============================================================
  loadBills() {
    this.isLoading = true;

    this.apiService.getBills().subscribe({
      next: (response: any) => {
        if (response && response.success) {
          this.allBills = response.data || [];
          this.applyFilters();
        }
        this.isLoading = false;
      },
      error: (error) => {
        console.error('❌ Error loading bills:', error);
        this.isLoading = false;
        this.showAlert('Error', 'Could not load bills.');
      },
    });
  }

  refreshBills() { this.loadBills(); }

  // ============================================================
  // SEARCH INPUT (debounced)
  // ============================================================
  onSearchInput() {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.applyFilters(), 250);
  }

  clearSearch() {
    this.searchTerm = '';
    this.applyFilters();
  }

  // ============================================================
  // DATE CHANGE
  // ============================================================
  onDateChange() {
    this.activeQuickRange = '';     // manual typing overrides chip
    this.applyFilters();
  }

  clearDate(which: 'start' | 'end') {
    if (which === 'start') this.startDate = '';
    else this.endDate = '';
    this.activeQuickRange = '';
    this.applyFilters();
  }

  clearAllFilters() {
    this.searchTerm = '';
    this.startDate = '';
    this.endDate = '';
    this.activeQuickRange = '';
    this.applyFilters();
  }

  // ============================================================
  // QUICK RANGE
  // ============================================================
  applyQuickRange(id: string) {
    const today = new Date();

    if (id === 'clear') {
      this.startDate = '';
      this.endDate = '';
      this.activeQuickRange = '';
      this.applyFilters();
      return;
    }

    let start = new Date(today);
    let end = new Date(today);

    if (id === 'today') {
      // today only
    } else if (id === 'week') {
      const day = today.getDay();               // 0 = Sun
      start = new Date(today);
      start.setDate(today.getDate() - day);     // start of this week (Sunday)
    } else if (id === 'month') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    } else if (id === 'year') {
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
    }

    this.startDate = this.toIso(start);
    this.endDate = this.toIso(end);
    this.activeQuickRange = id;
    this.applyFilters();
  }

  private toIso(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  // ============================================================
  // SMART DATE PARSING (year / month / day / combined)
  // ============================================================
  /**
   * Parse a flexible date string. Returns { start, end } as ms timestamps,
   * or nulls when input is empty / invalid.
   *   - "2026"           → full year
   *   - "Oct" / "October"→ whole month (any year? we assume current year)
   *   - "10"             → 10th of CURRENT month/year
   *   - "Oct 2026"       → Oct 2026
   *   - "2026-10"        → Oct 2026
   *   - "2026-10-15"     → that day
   */
  private parseFlexible(input: string, mode: 'start' | 'end'): { start: number | null; end: number | null } {
    const empty = { start: null, end: null };
    if (!input || !input.trim()) return empty;

    const s = input.trim().toLowerCase();
    const now = new Date();

    // 1. Full ISO date: 2026-10-15
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, +m[3]);
      return this.dayRange(d);
    }

    // 2. ISO year-month: 2026-10
    m = s.match(/^(\d{4})-(\d{1,2})$/);
    if (m) {
      const d = new Date(+m[1], +m[2] - 1, 1);
      return this.monthRange(d);
    }

    // 3. Year only: 2026
    m = s.match(/^(\d{4})$/);
    if (m) {
      return this.yearRange(+m[1]);
    }

    // 4. Month + year (with optional space/dash/comma): "oct 2026", "oct, 2026", "oct-2026"
    m = s.match(/^([a-z]+)[\s,\-]+(\d{4})$/);
    if (m) {
      const month = this.monthFromName(m[1]);
      if (month !== null) {
        const d = new Date(+m[2], month, 1);
        return this.monthRange(d);
      }
    }

    // 5. Year + month name: "2026 oct"
    m = s.match(/^(\d{4})[\s,\-]+([a-z]+)$/);
    if (m) {
      const month = this.monthFromName(m[2]);
      if (month !== null) {
        const d = new Date(+m[1], month, 1);
        return this.monthRange(d);
      }
    }

    // 6. Month name only: "oct", "october"
    const monthOnly = this.monthFromName(s);
    if (monthOnly !== null) {
      const d = new Date(now.getFullYear(), monthOnly, 1);
      return this.monthRange(d);
    }

    // 7. Day only (1–31): "15"  → assume CURRENT month/year
    m = s.match(/^(\d{1,2})$/);
    if (m) {
      const day = +m[1];
      if (day >= 1 && day <= 31) {
        const d = new Date(now.getFullYear(), now.getMonth(), day);
        if (d.getMonth() === now.getMonth()) {   // sanity
          return this.dayRange(d);
        }
      }
    }

    // 8. Fallback — let JS try (e.g., "15 Oct 2026")
    const fallback = new Date(input);
    if (!isNaN(fallback.getTime())) {
      return this.dayRange(fallback);
    }

    return empty;
  }

  private monthFromName(name: string): number | null {
    const map: { [k: string]: number } = {
      jan: 0, january: 0,
      feb: 1, february: 1,
      mar: 2, march: 2,
      apr: 3, april: 3,
      may: 4,
      jun: 5, june: 5,
      jul: 6, july: 6,
      aug: 7, august: 7,
      sep: 8, sept: 8, september: 8,
      oct: 9, october: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };
    return map[name] ?? null;
  }

  private dayRange(d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }

  private monthRange(d: Date) {
    const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
    const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }

  private yearRange(y: number) {
    const start = new Date(y, 0, 1, 0, 0, 0, 0);
    const end   = new Date(y, 11, 31, 23, 59, 59, 999);
    return { start: start.getTime(), end: end.getTime() };
  }

  /**
   * Convert a bill's `date` string into a timestamp.
   * Handles: "2026-07-21", "21-07-2026", "21/07/2026", ISO with time, Date.parse-able.
   */
  private billDateMs(bill: any): number | null {
    const raw = bill?.date || bill?.created_at;
    if (!raw) return null;

    const s = String(raw).trim();

    // 2026-07-21 or 2026-07-21T10:00:00
    let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]).getTime();

    // 21-07-2026 or 21/07/2026
    m = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]).getTime();

    // Fallback
    const t = new Date(s).getTime();
    return isNaN(t) ? null : t;
  }

  // ============================================================
  // APPLY FILTERS (date range + search, combined)
  // ============================================================
  private applyFilters() {
    let list = [...this.allBills];

    // ----- Date range -----
    const startP = this.parseFlexible(this.startDate, 'start');
    const endP   = this.parseFlexible(this.endDate,   'end');

    let startMs = startP.start;    // may be null
    let endMs   = endP.end;        // may be null

    // Auto-swap if both set and start > end
    if (startMs !== null && endMs !== null && startMs > endMs) {
      [startMs, endMs] = [endMs, startMs];
    }

    if (startMs !== null || endMs !== null) {
      list = list.filter(b => {
        const ms = this.billDateMs(b);
        if (ms === null) return false;
        if (startMs !== null && ms < startMs) return false;
        if (endMs   !== null && ms > endMs)   return false;
        return true;
      });
    }

    // ----- Search term -----
    const term = (this.searchTerm || '').toLowerCase().trim();
    if (term) {
      list = list.filter(bill => {
        const vendor     = (bill.vendor || '').toLowerCase();
        const billNumber = (bill.bill_number || '').toLowerCase();
        const date       = (bill.date || '').toLowerCase();
        const gstin      = (bill.gstin || '').toLowerCase();
        const category   = (bill.category || '').toLowerCase();
        return vendor.includes(term)
            || billNumber.includes(term)
            || date.includes(term)
            || gstin.includes(term)
            || category.includes(term);
      });
    }

    this.filteredBills = list;
    this.calculateStats();
  }

  // ============================================================
  // INLINE CALENDAR
  // ============================================================
  toggleCalendar(field: 'start' | 'end') {
    this.showCalendarFor = this.showCalendarFor === field ? '' : field;
  }

  prevMonth(field: 'start' | 'end') {
    const v = this.calView[field];
    v.m--;
    if (v.m < 0) { v.m = 11; v.y--; }
  }

  nextMonth(field: 'start' | 'end') {
    const v = this.calView[field];
    v.m++;
    if (v.m > 11) { v.m = 0; v.y++; }
  }

  calendarMonthName(field: 'start' | 'end'): string {
    const v = this.calView[field];
    return new Date(v.y, v.m, 1).toLocaleString('en-IN', { month: 'long' });
  }

  calendarYear(field: 'start' | 'end'): number {
    return this.calView[field].y;
  }

  /**
   * Returns an array of 42 cells (6 rows × 7 cols).
   * null = empty cell.
   */
  calendarDays(field: 'start' | 'end'): (number | null)[] {
    const v = this.calView[field];
    const first = new Date(v.y, v.m, 1);
    const startWeekday = first.getDay();               // 0 = Sun
    const daysInMonth = new Date(v.y, v.m + 1, 0).getDate();

    const cells: (number | null)[] = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length < 42) cells.push(null);
    return cells;
  }

  isToday(day: number | null, field: 'start' | 'end'): boolean {
    if (!day) return false;
    const v = this.calView[field];
    const now = new Date();
    return now.getFullYear() === v.y
        && now.getMonth() === v.m
        && now.getDate() === day;
  }

  isSelected(day: number | null, field: 'start' | 'end'): boolean {
    if (!day) return false;
    const current = field === 'start' ? this.startDate : this.endDate;
    if (!current) return false;
    const v = this.calView[field];
    const iso = `${v.y}-${String(v.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return current === iso;
  }

  pickDate(day: number | null, field: 'start' | 'end') {
    if (!day) return;
    const v = this.calView[field];
    const iso = `${v.y}-${String(v.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (field === 'start') this.startDate = iso;
    else this.endDate = iso;
    this.showCalendarFor = '';
    this.activeQuickRange = '';
    this.applyFilters();
  }

  pickToday(field: 'start' | 'end') {
    const iso = this.toIso(new Date());
    if (field === 'start') this.startDate = iso;
    else this.endDate = iso;
    this.showCalendarFor = '';
    this.activeQuickRange = '';
    this.applyFilters();
  }

  pickClear(field: 'start' | 'end') {
    this.clearDate(field);
    this.showCalendarFor = '';
  }

  // ============================================================
  // STATS
  // ============================================================
  calculateStats() {
    this.stats.totalAmount = this.filteredBills.reduce(
      (sum, bill) => sum + Number(bill.total || 0), 0
    );
  }

  // ============================================================
  // ACTIONS
  // ============================================================
  viewBill(id: number) {
    this.router.navigate(['/bill-detail', id]);
  }

  // ============================================================
  // SOFT DELETE
  // ============================================================
  deleteBill(id: number, event: Event) {
    event.stopPropagation();
    this.confirmDelete(id);
  }

  async confirmDelete(id: number) {
    const bill = this.allBills.find(b => b.id === id);
    const billLabel = bill
      ? `"${bill.vendor}" (#${bill.bill_number || id})`
      : 'This bill';

    const role = this.auth.getRole();
    const requiresReason = role === 'super_admin' || role === 'clerk';

    if (!requiresReason) {
      const alert = await this.alertController.create({
        header: 'Move to Recycle Bin?',
        message: `${billLabel} will be moved to the recycle bin. You can restore or permanently delete it later.`,
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Move to Bin',
            role: 'destructive',
            handler: () => this.performDelete(id, undefined),
          },
        ],
      });
      await alert.present();
      return;
    }

    const alert = await this.alertController.create({
      header: 'Move to Recycle Bin?',
      message: `${billLabel} will be moved to the recycle bin.`,
      inputs: [
        {
          name: 'reason',
          type: 'textarea',
          placeholder: 'Reason for deletion (required, min 3 chars)',
          attributes: { maxlength: 500, minlength: 3, rows: 3 },
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Move to Bin',
          role: 'destructive',
          handler: (data) => {
            const reason = (data.reason || '').trim();
            if (!reason || reason.length < 3) {
              this.showToast('Reason must be at least 3 characters', 'warning');
              return false;
            }
            if (reason.length > 500) {
              this.showToast('Reason too long (max 500 chars)', 'warning');
              return false;
            }
            this.performDelete(id, reason);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private performDelete(id: number, reason?: string) {
    this.apiService.deleteBill(id, reason).subscribe({
      next: () => {
        this.loadBills();
        this.showToast('Bill moved to recycle bin', 'success');
      },
      error: (error) => {
        console.error('❌ Delete error:', error);
        this.showToast(error?.error?.error || 'Failed to delete bill', 'danger');
      },
    });
  }

  // ============================================================
  // NAVIGATION
  // ============================================================
  goToUpload() {
    this.router.navigateByUrl('/upload');
  }

  goToExport() {
    this.router.navigateByUrl('/export');
  }

  goToRecycleBin() {
    this.router.navigateByUrl('/recycle-bin');
  }

  // ============================================================
  // UI HELPERS
  // ============================================================
  formatCurrency(amount: number): string {
    if (!amount) return '₹0';
    return '₹' + Number(amount).toLocaleString('en-IN');
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
    });
    await toast.present();
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
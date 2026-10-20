// ============================================================
// FILE: src/app/complaints/complaints.model.ts
// PURPOSE: Complaint types + localStorage helpers (no backend)
// ============================================================

export type ComplaintStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';
export type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Complaint {
  id: string;                 // "C001", "C002", ...
  subject: string;
  category: string;
  priority: ComplaintPriority;
  description: string;
  status: ComplaintStatus;
  filedBy: string;            // username or "guest"
  filedByRole: string;        // "clerk", "sso", "sso_admin", "guest"
  filedByGroup: string;       // "adfm_1", etc.
  createdAt: string;          // ISO timestamp
}

const STORAGE_KEY = 'rly_complaints';

// ------------------------------------------------------------
// CATEGORIES
// ------------------------------------------------------------
export const COMPLAINT_CATEGORIES = [
  'Hardware',
  'Software',
  'Network',
  'HR',
  'Finance',
  'Other',
];

// ------------------------------------------------------------
// PRIORITIES
// ------------------------------------------------------------
export const COMPLAINT_PRIORITIES: ComplaintPriority[] = [
  'low',
  'medium',
  'high',
  'urgent',
];

// ------------------------------------------------------------
// READ
// ------------------------------------------------------------
export function loadComplaints(): Complaint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr as Complaint[];
  } catch {
    return [];
  }
}

// ------------------------------------------------------------
// WRITE
// ------------------------------------------------------------
export function saveComplaints(list: Complaint[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// ------------------------------------------------------------
// NEXT COMPLAINT NUMBER  →  C001, C002, ...
// ------------------------------------------------------------
export function nextComplaintNumber(list: Complaint[]): string {
  let maxNum = 0;
  for (const c of list) {
    const m = String(c.id || '').match(/^C(\d+)$/);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }
  const next = maxNum + 1;
  return 'C' + String(next).padStart(3, '0');
}

// ------------------------------------------------------------
// CREATE
// ------------------------------------------------------------
export interface CreateComplaintInput {
  subject: string;
  category: string;
  priority: ComplaintPriority;
  description: string;
  filedBy: string;
  filedByRole: string;
  filedByGroup: string;
}

export function createComplaint(input: CreateComplaintInput): Complaint {
  const list = loadComplaints();
  const id = nextComplaintNumber(list);

  const complaint: Complaint = {
    id,
    subject: input.subject.trim(),
    category: input.category,
    priority: input.priority,
    description: input.description.trim(),
    status: 'open',
    filedBy: input.filedBy || 'guest',
    filedByRole: input.filedByRole || 'guest',
    filedByGroup: input.filedByGroup || 'all',
    createdAt: new Date().toISOString(),
  };

  list.push(complaint);
  saveComplaints(list);
  return complaint;
}

// ------------------------------------------------------------
// HELPER — get complaints filed by a specific user
// ------------------------------------------------------------
export function getComplaintsByUser(username: string): Complaint[] {
  if (!username) return [];
  return loadComplaints()
    .filter(c => c.filedBy === username)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ------------------------------------------------------------
// COLOR / LABEL HELPERS
// ------------------------------------------------------------
export function getPriorityColor(p: ComplaintPriority): string {
  if (p === 'urgent') return 'danger';
  if (p === 'high')   return 'warning';
  if (p === 'medium') return 'primary';
  return 'medium';
}

export function getStatusColor(s: ComplaintStatus): string {
  if (s === 'resolved')    return 'success';
  if (s === 'rejected')    return 'danger';
  if (s === 'in_progress') return 'warning';
  return 'primary';
}

export function getStatusIcon(s: ComplaintStatus): string {
  if (s === 'resolved')    return 'checkmark-circle-outline';
  if (s === 'rejected')    return 'close-circle-outline';
  if (s === 'in_progress') return 'time-outline';
  return 'alert-circle-outline';
}

export function getStatusLabel(s: ComplaintStatus): string {
  if (s === 'resolved')    return 'Resolved';
  if (s === 'rejected')    return 'Rejected';
  if (s === 'in_progress') return 'In Progress';
  return 'Open';
}

export function formatRelativeTime(iso: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}
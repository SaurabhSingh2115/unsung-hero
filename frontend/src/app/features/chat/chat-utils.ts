// Small pure helpers shared by the Chat clone components (dates, grouping, errors).
import { HttpErrorResponse } from '@angular/common/http';
import { ChatMessage } from '../../core/models';

const TIME = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const MONTH_DAY = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const MONTH_DAY_YEAR = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const WEEKDAY_LONG = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const WEEKDAY_LONG_YEAR = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function daysAgo(iso: string): number {
  const d = new Date(iso);
  const now = new Date();
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "10:42 AM" today, "Yesterday 10:42 AM", "Oct 3, 10:42 AM", "Oct 3, 2025, 10:42 AM". */
export function formatStamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const ago = daysAgo(iso);
  const t = TIME.format(d);
  if (ago === 0) return t;
  if (ago === 1) return `Yesterday ${t}`;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${(sameYear ? MONTH_DAY : MONTH_DAY_YEAR).format(d)}, ${t}`;
}

/** Short form used in the space list: "10:42 AM", "Yesterday", "Oct 3". */
export function formatShort(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const ago = daysAgo(iso);
  if (ago === 0) return TIME.format(d);
  if (ago === 1) return 'Yesterday';
  return (d.getFullYear() === new Date().getFullYear() ? MONTH_DAY : MONTH_DAY_YEAR).format(d);
}

/** Date separator label: "Today", "Yesterday", "Thursday, October 3". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const ago = daysAgo(iso);
  if (ago === 0) return 'Today';
  if (ago === 1) return 'Yesterday';
  return (d.getFullYear() === new Date().getFullYear() ? WEEKDAY_LONG : WEEKDAY_LONG_YEAR).format(d);
}

export function byCreated(a: ChatMessage, b: ChatMessage): number {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/** Messages that belong to a thread, keyed by root id, oldest first. */
export function groupReplies(messages: ChatMessage[]): Map<string, ChatMessage[]> {
  const map = new Map<string, ChatMessage[]>();
  for (const m of messages) {
    if (!m.thread_id) continue;
    const list = map.get(m.thread_id);
    if (list) list.push(m); else map.set(m.thread_id, [m]);
  }
  for (const list of map.values()) list.sort(byCreated);
  return map;
}

export function isUnreachable(err: unknown): boolean {
  if (!(err instanceof HttpErrorResponse)) return true;
  // 0 = network error; 502/503/504 = dev-server proxy can't reach FastAPI.
  return err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504
    || (err.status === 500 && typeof err.error === 'string' && /ECONNREFUSED|proxy/i.test(err.error));
}

export function errorMessage(err: unknown): string {
  if (isUnreachable(err)) return "Can't reach Chat server";
  if (err instanceof HttpErrorResponse) {
    if (err.status === 403 || err.status === 404) return "This conversation doesn't exist or you're not a member.";
    const detail = typeof err.error === 'object' && err.error && 'detail' in err.error ? String(err.error.detail) : err.statusText;
    return `Something went wrong (${err.status}${detail ? ': ' + detail : ''})`;
  }
  return 'Something went wrong';
}

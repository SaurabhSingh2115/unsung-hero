// Relative date pipe ("3d ago", "Oct 3") and short date helpers.
import { Pipe, PipeTransform } from '@angular/core';

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function relDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return shortDate(iso);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`;
  return shortDate(iso);
}

@Pipe({ name: 'relDate' })
export class RelDatePipe implements PipeTransform {
  transform(iso: string | null | undefined): string { return relDate(iso); }
}

@Pipe({ name: 'shortDate' })
export class ShortDatePipe implements PipeTransform {
  transform(iso: string | null | undefined): string { return shortDate(iso); }
}

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform(v: number | null | undefined, digits = 0): string {
    return v === null || v === undefined ? '—' : `${(v * 100).toFixed(digits)}%`;
  }
}

// Tiny signal-based wrapper around one-shot HTTP observables: data / loading / error.
import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { Observable, Subscription } from 'rxjs';

export function friendlyError(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0 || err.status === 502 || err.status === 504) {
      return "Can't reach the Unsung backend. Is it running on :8000?";
    }
    if (err.status === 403) return "You don't have access to this view.";
    if (err.status === 404) return 'Not found.';
    const detail = (err.error && typeof err.error === 'object' && 'detail' in err.error) ? String(err.error.detail) : err.message;
    return `Something went wrong (${err.status}): ${detail}`;
  }
  return 'Something went wrong.';
}

export class Loadable<T> {
  readonly data = signal<T | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  private sub?: Subscription;

  load(obs: Observable<T>, opts: { keepData?: boolean; onNext?: (v: T) => void } = {}): void {
    this.sub?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    if (!opts.keepData) this.data.set(null);
    this.sub = obs.subscribe({
      next: v => { this.data.set(v); this.loading.set(false); opts.onNext?.(v); },
      error: e => { this.error.set(friendlyError(e)); this.loading.set(false); },
    });
  }

  cancel(): void { this.sub?.unsubscribe(); }
}

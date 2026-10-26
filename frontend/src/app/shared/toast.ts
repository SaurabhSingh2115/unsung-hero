// Toast notifications (service + host rendered once in the shell).
import { ChangeDetectionStrategy, Component, Injectable, inject, signal } from '@angular/core';

export interface Toast { id: number; text: string; kind: 'success' | 'error' | 'info'; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  show(text: string, kind: Toast['kind'] = 'success', ms = 4000): void {
    const id = ++this.seq;
    this.toasts.update(t => [...t, { id, text, kind }]);
    setTimeout(() => this.dismiss(id), ms);
  }
  success(text: string) { this.show(text, 'success'); }
  error(text: string) { this.show(text, 'error', 6000); }
  dismiss(id: number) { this.toasts.update(t => t.filter(x => x.id !== id)); }
}

@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed bottom-5 left-1/2 z-[100] flex -translate-x-1/2 flex-col items-center gap-2">
      @for (t of toasts.toasts(); track t.id) {
        <div class="pointer-events-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
             [class.bg-ink]="t.kind !== 'error'" [class.text-white]="true" [class.bg-rose-600]="t.kind === 'error'"
             role="status">
          <span class="material-symbols-outlined text-base"
                [class.text-amber]="t.kind === 'success'">{{ t.kind === 'error' ? 'error' : t.kind === 'success' ? 'check_circle' : 'info' }}</span>
          {{ t.text }}
          <button class="ml-2 opacity-70 hover:opacity-100" (click)="toasts.dismiss(t.id)" aria-label="Dismiss">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  readonly toasts = inject(ToastService);
}

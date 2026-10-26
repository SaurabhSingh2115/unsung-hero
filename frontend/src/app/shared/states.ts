// Loading skeletons + friendly error / empty states.
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-3 animate-pulse" aria-busy="true" aria-label="Loading">
      @for (r of rowsArr(); track $index) {
        <div class="h-4 rounded-lg bg-stone-200/80" [style.width.%]="r"></div>
      }
    </div>
  `,
})
export class Skeleton {
  readonly rows = input(4);
  rowsArr() { return Array.from({ length: this.rows() }, (_, i) => 95 - ((i * 17) % 40)); }
}

@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card flex items-start gap-3 border-rose-200 bg-rose-50/60 p-4 text-sm text-rose-900">
      <span class="material-symbols-outlined text-rose-500">cloud_off</span>
      <div class="flex-1">
        <div class="font-medium">{{ message() }}</div>
        <div class="mt-0.5 text-rose-800/80">The rest of Unsung keeps working — try again in a moment.</div>
      </div>
      <button class="btn-ghost" (click)="retry.emit()"><span class="material-symbols-outlined text-base">refresh</span>Retry</button>
    </div>
  `,
})
export class ErrorState {
  readonly message = input('Something went wrong.');
  readonly retry = output<void>();
}

@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center text-stone-500">
      <span class="material-symbols-outlined text-4xl text-stone-300">{{ icon() }}</span>
      <div class="font-medium text-stone-700">{{ title() }}</div>
      @if (hint()) { <div class="max-w-md text-sm">{{ hint() }}</div> }
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly icon = input('inbox');
  readonly title = input('Nothing here yet');
  readonly hint = input<string | null>(null);
}

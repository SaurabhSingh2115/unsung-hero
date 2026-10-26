// Unsung logo: indigo rounded square with an amber sparkle + wordmark.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-2">
      <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 32 32" aria-hidden="true">
        <rect x="1" y="1" width="30" height="30" rx="8" fill="#1e1b4b" />
        <path d="M9 9v8a7 7 0 0 0 14 0V9" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" />
        <path d="M24 3.5l1.1 2.9 2.9 1.1-2.9 1.1L24 11.5l-1.1-2.9-2.9-1.1 2.9-1.1z" fill="#f2b544" />
      </svg>
      @if (wordmark()) { <span class="text-xl font-bold tracking-tight text-ink">Unsung</span> }
    </span>
  `,
})
export class Logo {
  readonly size = input(32);
  readonly wordmark = input(true);
}

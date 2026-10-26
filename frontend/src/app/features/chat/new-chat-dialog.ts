// "New chat" people picker: choose a person to open (or create) a DM with.
import { ChangeDetectionStrategy, Component, ElementRef, afterNextRender, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { ChatAvatar } from './avatar';

@Component({
  selector: 'chat-new-chat-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatAvatar],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]" (click)="closed.emit()">
      <div role="dialog" aria-modal="true" aria-labelledby="newchat-title"
        class="w-[440px] max-w-[92vw] overflow-hidden rounded-3xl bg-white shadow-2xl font-chat" (click)="$event.stopPropagation()">
        <div class="flex items-center justify-between px-6 pt-5">
          <h2 id="newchat-title" class="text-lg text-[#1f1f1f]">New chat</h2>
          <button type="button" class="icon-btn" aria-label="Close" (click)="closed.emit()">
            <span class="material-symbols-outlined">close</span>
          </button>
        </div>
        <div class="px-6 pt-3">
          <label class="flex items-center gap-2 rounded-full bg-[#e9eef6] px-4 py-2 focus-within:bg-white focus-within:shadow-[0_0_0_2px_var(--color-gchat-blue)]">
            <span class="material-symbols-outlined text-[20px] text-[#444746]">person_search</span>
            <input #search class="w-full bg-transparent text-sm outline-none placeholder:text-[#5f6368]" placeholder="Add a person"
              aria-label="Search people" [value]="query()" (input)="query.set(search.value)" (keydown.enter)="pickFirst()" />
          </label>
        </div>
        <ul class="max-h-[50vh] overflow-y-auto py-2" role="listbox" aria-label="People">
          @for (p of filtered(); track p.id) {
            <li>
              <button type="button" role="option" aria-selected="false" [disabled]="busy()"
                class="flex w-full items-center gap-3 px-6 py-2 text-left hover:bg-[#f2f6fc] focus-visible:bg-[#e9eef6] focus-visible:outline-none cursor-pointer disabled:opacity-60"
                (click)="pick.emit(p.id)">
                <chat-avatar [personId]="p.id" [size]="36" />
                <span class="min-w-0">
                  <span class="block truncate text-sm text-[#1f1f1f]">{{ p.name }}</span>
                  <span class="block truncate text-xs text-[#5f6368]">{{ p.email }}</span>
                </span>
              </button>
            </li>
          } @empty {
            <li class="px-6 py-4 text-sm text-[#5f6368]">No matching people</li>
          }
        </ul>
        @if (error()) {
          <div class="mx-6 mb-4 rounded-xl bg-[#fce8e6] px-3 py-2 text-sm text-[#b3261e]">{{ error() }}</div>
        }
      </div>
    </div>
  `,
  styles: `.icon-btn { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:999px; color:#444746; cursor:pointer; }
    .icon-btn:hover { background:#f1f3f4; } .icon-btn:focus-visible { outline:2px solid var(--color-gchat-blue); }`,
})
export class NewChatDialog {
  private session = inject(SessionService);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly pick = output<string>();
  readonly closed = output<void>();
  protected query = signal('');
  private searchEl = viewChild<ElementRef<HTMLInputElement>>('search');

  protected filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.session.people()
      .filter(p => p.id !== this.session.chatUserId())
      .filter(p => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q));
  });

  constructor() {
    afterNextRender(() => this.searchEl()?.nativeElement.focus());
  }

  protected pickFirst() {
    const first = this.filtered()[0];
    if (first) this.pick.emit(first.id);
  }
}

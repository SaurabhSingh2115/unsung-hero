// Right-side thread panel: root message + replies (oldest first) + composer posting into the thread.
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { ChatMessage, Person } from '../../core/models';
import { Composer } from './composer';
import { MessageItem } from './message-item';

@Component({
  selector: 'chat-thread-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessageItem, Composer],
  host: { class: 'flex flex-col min-h-0', '(keydown.escape)': 'close.emit()' },
  template: `
    <header class="flex h-14 shrink-0 items-center gap-2 border-b border-[#e3e3e3] pl-5 pr-2">
      <div class="min-w-0 flex-1">
        <h2 class="text-[15px] font-medium text-[#1f1f1f]">Thread</h2>
        <p class="truncate text-xs text-[#5f6368]">{{ spaceName() }}</p>
      </div>
      <button type="button" class="icon-btn" aria-label="Close thread" title="Close thread" (click)="close.emit()">
        <span class="material-symbols-outlined">close</span>
      </button>
    </header>

    <div #viewport class="flex-1 overflow-y-auto px-2 py-3" role="log" aria-label="Thread messages">
      @if (root(); as r) {
        <chat-message-item [message]="r" [showThread]="false" [highlighted]="r.id === highlightId()" [failed]="failedIds().has(r.id)" />
        <div class="my-2 flex items-center gap-3 px-3">
          <span class="text-xs font-medium text-[#444746]">{{ replies().length }} {{ replies().length === 1 ? 'reply' : 'replies' }}</span>
          <div class="h-px flex-1 bg-[#e3e3e3]"></div>
        </div>
        @for (m of replies(); track m.id) {
          <chat-message-item [message]="m" [compact]="true" [showThread]="false"
            [highlighted]="m.id === highlightId()" [failed]="failedIds().has(m.id)"
            (retry)="retry.emit($event)" (discard)="discard.emit($event)" />
        } @empty {
          <p class="px-3 py-2 text-sm text-[#5f6368]">No replies yet — be the first to reply.</p>
        }
      } @else {
        <p class="px-3 py-6 text-center text-sm text-[#5f6368]">This thread could not be found.</p>
      }
    </div>

    <div class="shrink-0 px-4 pb-4 pt-1">
      <chat-composer #composer placeholder="Reply" [members]="members()" [disabled]="!root()" (send)="send.emit($event)" />
    </div>
  `,
  styles: `.icon-btn { display:inline-flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:999px; color:#444746; cursor:pointer; }
    .icon-btn:hover { background:#f1f3f4; } .icon-btn:focus-visible { outline:2px solid var(--color-gchat-blue); }`,
})
export class ThreadPanel {
  private injector = inject(Injector);
  readonly root = input<ChatMessage | null>(null);
  readonly replies = input<ChatMessage[]>([]);
  readonly members = input<Person[]>([]);
  readonly spaceName = input('');
  readonly highlightId = input<string | null>(null);
  readonly failedIds = input<Set<string>>(new Set());
  readonly close = output<void>();
  readonly send = output<string>();
  readonly retry = output<ChatMessage>();
  readonly discard = output<ChatMessage>();

  private viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  private composer = viewChild<Composer>('composer');
  private lastRoot: string | null = null;
  private lastCount = 0;
  private scrolledHighlight: string | null = null;

  constructor() {
    effect(() => {
      const rootId = this.root()?.id ?? null;
      const count = this.replies().length;
      const highlight = this.highlightId();
      untracked(() => afterNextRender(() => this.afterUpdate(rootId, count, highlight), { injector: this.injector }));
    });
  }

  private afterUpdate(rootId: string | null, count: number, highlight: string | null) {
    const el = this.viewport().nativeElement;
    const rootChanged = rootId !== this.lastRoot;
    const grew = count > this.lastCount;
    this.lastRoot = rootId;
    this.lastCount = count;
    if (highlight && highlight !== this.scrolledHighlight) {
      const target = el.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(highlight)}"]`);
      if (target) { this.scrolledHighlight = highlight; target.scrollIntoView({ block: 'center' }); return; }
    }
    if (rootChanged || grew) {
      el.scrollTop = el.scrollHeight;
      if (rootChanged && !highlight) this.composer()?.focus();
    }
  }
}

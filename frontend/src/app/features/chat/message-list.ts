// Threaded-space message list: root messages grouped by day, thread footers, auto-scroll + deep-link highlight.
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, output, untracked, viewChild,
} from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { ChatMessage } from '../../core/models';
import { byCreated, dayKey, dayLabel, groupReplies } from './chat-utils';
import { MessageItem } from './message-item';

interface DayGroup { key: string; label: string; roots: ChatMessage[]; }

@Component({
  selector: 'chat-message-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MessageItem],
  host: { class: 'block min-h-0' },
  template: `
    <div #viewport class="h-full overflow-y-auto px-4 pb-2 pt-2" (scroll)="onScroll()" role="log" aria-live="polite" aria-label="Messages">
      @if (query().trim() && !groups().length) {
        <div class="flex h-full flex-col items-center justify-center text-center text-[#5f6368]">
          <span class="material-symbols-outlined text-[40px] text-[#9aa0a6]">search_off</span>
          <p class="mt-2 text-sm">No messages match “{{ query() }}”</p>
        </div>
      } @else if (!groups().length) {
        <div class="flex h-full flex-col items-center justify-center text-center text-[#5f6368]">
          <span class="material-symbols-outlined text-[48px] text-[#9aa0a6]">forum</span>
          <p class="mt-2 text-sm">No messages yet. Start the conversation!</p>
        </div>
      } @else {
        @if (query().trim()) {
          <p class="px-3 pb-1 pt-2 text-xs text-[#5f6368]">{{ matchCount() }} {{ matchCount() === 1 ? 'conversation matches' : 'conversations match' }} “{{ query() }}”</p>
        }
        @for (g of groups(); track g.key) {
          <div class="sticky top-0 z-10 flex items-center gap-3 py-2" role="separator" [attr.aria-label]="g.label">
            <div class="h-px flex-1 bg-[#e3e3e3]"></div>
            <span class="rounded-full border border-[#e3e3e3] bg-white px-3 py-0.5 text-xs font-medium text-[#444746]">{{ g.label }}</span>
            <div class="h-px flex-1 bg-[#e3e3e3]"></div>
          </div>
          @for (m of g.roots; track m.id) {
            <chat-message-item class="mb-1 border-b border-[#f1f3f4] pb-1 last:border-b-0"
              [message]="m" [replies]="repliesFor(m.id)" [query]="query()"
              [highlighted]="m.id === highlightId()" [failed]="failedIds().has(m.id)"
              (openThread)="openThread.emit($event)" (retry)="retry.emit($event)" (discard)="discard.emit($event)" />
          }
        }
      }
    </div>
  `,
})
export class MessageList {
  private session = inject(SessionService);
  private injector = inject(Injector);

  readonly messages = input.required<ChatMessage[]>();
  readonly failedIds = input<Set<string>>(new Set());
  readonly query = input('');
  readonly highlightId = input<string | null>(null);
  /** Bump to force-scroll to the bottom (e.g. after sending or switching space). */
  readonly scrollToken = input(0);
  readonly openThread = output<string>();
  readonly retry = output<ChatMessage>();
  readonly discard = output<ChatMessage>();

  private viewport = viewChild.required<ElementRef<HTMLDivElement>>('viewport');
  private atBottom = true;
  private lastToken = -1;
  private scrolledHighlight: string | null = null;

  private replies = computed(() => groupReplies(this.messages()));
  private roots = computed(() => this.messages().filter(m => !m.thread_id).sort(byCreated));

  private filteredRoots = computed(() => {
    const q = this.query().trim().toLowerCase();
    const roots = this.roots();
    if (!q) return roots;
    const matches = (m: ChatMessage) =>
      m.text.toLowerCase().includes(q) || (this.session.person(m.sender_id)?.name.toLowerCase().includes(q) ?? false);
    return roots.filter(r => matches(r) || (this.replies().get(r.id) ?? []).some(matches));
  });
  protected matchCount = computed(() => this.filteredRoots().length);

  protected groups = computed<DayGroup[]>(() => {
    const out: DayGroup[] = [];
    for (const m of this.filteredRoots()) {
      const key = dayKey(m.created_at);
      let g = out[out.length - 1];
      if (!g || g.key !== key) { g = { key, label: dayLabel(m.created_at), roots: [] }; out.push(g); }
      g.roots.push(m);
    }
    return out;
  });

  protected repliesFor(id: string): ChatMessage[] { return this.replies().get(id) ?? []; }

  constructor() {
    effect(() => {
      this.groups();
      const token = this.scrollToken();
      const highlight = this.highlightId();
      untracked(() => afterNextRender(() => this.afterUpdate(token, highlight), { injector: this.injector }));
    });
  }

  protected onScroll() {
    const el = this.viewport().nativeElement;
    this.atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  private afterUpdate(token: number, highlight: string | null) {
    const el = this.viewport().nativeElement;
    if (highlight && highlight !== this.scrolledHighlight) {
      // Highlight target may be a root in this list (or a reply: then scroll to its root).
      const msg = this.messages().find(m => m.id === highlight);
      const targetId = msg?.thread_id ?? highlight;
      const target = el.querySelector<HTMLElement>(`[data-msg-id="${CSS.escape(targetId)}"]`);
      if (target) {
        this.scrolledHighlight = highlight;
        this.lastToken = token;
        target.scrollIntoView({ block: 'center' });
        this.onScroll();
        return;
      }
    }
    if (token !== this.lastToken || this.atBottom) {
      this.lastToken = token;
      el.scrollTop = el.scrollHeight;
      this.atBottom = true;
    }
  }
}

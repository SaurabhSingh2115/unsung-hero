// Say Thanks: weekly digest of people who helped you but haven't been thanked, with a drafted message.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Digest, ThankDraft, UnthankedHelper } from '../../core/models';
import { AppStateService } from '../../core/util/app-state.service';
import { parseLink } from '../../core/util/link';
import { Loadable, friendlyError } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { CategoryChip } from '../../shared/category';
import { ShortDatePipe } from '../../shared/pipes';
import { CitationChip } from '../../shared/source';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

type ThanksType = 'kudos' | 'peer_bonus';

const VERB: Record<string, string> = {
  unblocking: 'unblocked', review: 'reviewed for', mentoring: 'mentored', documentation: 'documented things for',
  onboarding: 'onboarded', firefighting: 'fought fires with', core: 'helped',
};

@Component({
  selector: 'app-thanks-page',
  imports: [FormsModule, RouterLink, Avatar, CategoryChip, ShortDatePipe, CitationChip, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Say thanks</h1>
    <p class="mt-1 text-sm text-stone-500">People who helped you recently and haven't been recognised yet. One click — with the receipts attached.</p>

    @if (digest.data(); as d) {
      <div class="mt-5 flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-white">
        <span class="material-symbols-outlined text-3xl text-amber">mark_email_unread</span>
        <div class="flex-1">
          <div class="text-xs uppercase tracking-wider text-white/60">Weekly digest · {{ d.week_start | shortDate }} – {{ d.week_end | shortDate }}</div>
          <div class="mt-0.5 font-medium">{{ d.message }}</div>
        </div>
      </div>
    }

    <div class="mt-6">
      @if (helpers.loading() && !helpers.data()) { <div class="card p-6"><app-skeleton [rows]="6" /></div> }
      @if (helpers.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (helpers.data(); as list) {
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          @for (h of list; track h.helper.id) {
            <div class="card flex flex-col p-5">
              <div class="flex items-center gap-3">
                <app-avatar [person]="h.helper" [size]="48" />
                <div>
                  <div class="font-semibold text-stone-900">{{ h.helper.first_name }} {{ verb(h) }} you {{ h.count }} time{{ h.count === 1 ? '' : 's' }}</div>
                  <div class="text-xs text-stone-500">{{ h.helper.title }}</div>
                </div>
              </div>
              <ul class="mt-3 flex-1 space-y-1.5">
                @for (a of h.activities.slice(0, 4); track a.id) {
                  <li class="flex items-center gap-2 text-sm">
                    <span class="w-12 shrink-0 text-xs text-stone-400">{{ a.timestamp | shortDate }}</span>
                    <app-category-chip [category]="a.category" />
                    <a class="truncate text-stone-700 hover:underline" [routerLink]="lp(a.link).path" [queryParams]="lp(a.link).queryParams" [attr.title]="a.text">{{ a.text }}</a>
                  </li>
                }
                @if (h.activities.length > 4) { <li class="text-xs text-stone-400">+ {{ h.activities.length - 4 }} more</li> }
              </ul>
              <div class="mt-4 flex gap-2">
                <button class="btn-amber flex-1 justify-center" (click)="open(h, 'kudos')">
                  <span class="material-symbols-outlined text-base">celebration</span>Send Kudos
                </button>
                <button class="btn-ghost flex-1 justify-center" (click)="open(h, 'peer_bonus')"
                        [style.border-color]="h.suggested_type === 'peer_bonus' ? '#f2b544' : null"
                        [style.border-width.px]="h.suggested_type === 'peer_bonus' ? 2 : null">
                  <span class="material-symbols-outlined text-base">redeem</span>Peer Bonus
                  @if (h.suggested_type === 'peer_bonus') { <span class="chip ml-1 bg-amber-soft !px-1.5 text-[10px] text-ink">recommended</span> }
                </button>
              </div>
            </div>
          } @empty {
            <div class="card md:col-span-2 xl:col-span-3">
              <app-empty-state icon="sentiment_very_satisfied" title="You're all caught up 🎉" hint="Everyone who helped you has been thanked. We'll let you know when that changes." />
            </div>
          }
        </div>
      }
    </div>

    <!-- slide-over drawer -->
    @if (active(); as h) {
      <div class="fixed inset-0 z-40 bg-ink/25" (click)="close()"></div>
      <aside class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl" role="dialog" aria-label="Send thanks">
        <header class="flex items-center gap-3 border-b border-line px-5 py-4">
          <app-avatar [person]="h.helper" [size]="36" />
          <div class="flex-1">
            <div class="font-semibold text-ink">{{ type() === 'peer_bonus' ? 'Peer bonus' : 'Kudos' }} for {{ h.helper.first_name }}</div>
            <div class="text-xs text-stone-500">via {{ draft.data()?.tool_name ?? toolName() }}</div>
          </div>
          <button class="rounded-lg p-1 hover:bg-stone-100" (click)="close()" aria-label="Close"><span class="material-symbols-outlined">close</span></button>
        </header>
        <div class="flex-1 overflow-y-auto p-5">
          @if (draft.loading()) {
            <div class="flex items-center gap-2 text-sm text-stone-500"><span class="material-symbols-outlined animate-spin text-amber">progress_activity</span>Drafting a specific, evidence-backed message…</div>
            <div class="mt-3"><app-skeleton [rows]="4" /></div>
          }
          @if (draft.error(); as e) { <app-error-state [message]="e" (retry)="fetchDraft()" /> }
          @if (draft.data(); as d) {
            <label class="text-xs font-semibold uppercase tracking-wide text-stone-500" for="msg">Message</label>
            <textarea id="msg" rows="8" [ngModel]="message()" (ngModelChange)="message.set($event)"
              class="mt-1 w-full rounded-xl border border-stone-300 p-3 text-sm leading-relaxed focus:border-ink focus:outline-none"></textarea>
            <div class="mt-1 text-right text-[11px] text-stone-400">{{ d.model === 'gemini' ? 'Drafted by Gemini' : 'Template draft' }} — edit freely</div>
            <div class="mt-3 text-xs font-semibold uppercase tracking-wide text-stone-500">Cited activities</div>
            <div class="mt-1.5 flex flex-wrap gap-1.5">@for (id of d.activity_ids; track id) { <app-citation-chip [id]="id" /> }</div>
          }
        </div>
        @if (draft.data(); as d) {
          <footer class="flex flex-col gap-2 border-t border-line p-5">
            <button class="btn-amber justify-center" [disabled]="sending()" (click)="openTool(d)">
              Open in {{ d.tool_name }} ↗
            </button>
            <button class="btn-ghost justify-center" [disabled]="sending()" (click)="copyAndSend()">
              <span class="material-symbols-outlined text-base">content_copy</span>Copy &amp; mark as sent
            </button>
          </footer>
        }
      </aside>
    }
  `,
})
export class ThanksPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private state = inject(AppStateService);
  private toast = inject(ToastService);

  readonly helpers = new Loadable<UnthankedHelper[]>();
  readonly digest = new Loadable<Digest>();
  readonly draft = new Loadable<ThankDraft>();
  readonly active = signal<UnthankedHelper | null>(null);
  readonly type = signal<ThanksType>('kudos');
  readonly sending = signal(false);
  readonly toolName = computed(() => this.state.config()?.recognition_tool_name ?? 'gThanks');
  readonly message = signal('');

  constructor() { this.load(); }

  load() {
    const me = this.session.userId(); if (!me) return;
    this.helpers.load(this.api.unthankedHelpers(me), { keepData: true });
    this.digest.load(this.api.digest(me), { keepData: true });
  }

  verb(h: UnthankedHelper): string {
    const counts: Record<string, number> = {};
    for (const a of h.activities) counts[a.category] = (counts[a.category] ?? 0) + 1;
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    return VERB[top ?? 'core'] ?? 'helped';
  }
  lp(link: string) { return parseLink(link); }

  open(h: UnthankedHelper, type: ThanksType) {
    this.active.set(h); this.type.set(type); this.message.set('');
    this.fetchDraft();
  }
  close() { this.active.set(null); this.draft.cancel(); this.draft.data.set(null); }

  fetchDraft() {
    const h = this.active(); const me = this.session.userId(); if (!h || !me) return;
    this.draft.load(
      this.api.thankDraft(me, { helper_id: h.helper.id, activity_ids: h.activities.map(a => a.id), type: this.type() }),
      { onNext: d => this.message.set(d.message) },
    );
  }

  openTool(d: ThankDraft) {
    // The prefilled link carries the drafted message; edits are also copied to the clipboard as a fallback.
    navigator.clipboard?.writeText(this.message()).catch(() => undefined);
    window.open(d.recognition_link, '_blank', 'noopener');
    this.markSent();
  }

  copyAndSend() {
    navigator.clipboard?.writeText(this.message()).catch(() => undefined);
    this.markSent();
  }

  private markSent() {
    const h = this.active(); const d = this.draft.data(); if (!h || !d) return;
    this.sending.set(true);
    this.api.sendRecognition({ to_id: h.helper.id, activity_ids: d.activity_ids, type: this.type(), message: this.message() || d.message }).subscribe({
      next: () => {
        this.sending.set(false);
        this.toast.success(`Thanks sent — ${h.helper.first_name}'s recognition gap updated`);
        this.helpers.data.update(list => (list ?? []).filter(x => x.helper.id !== h.helper.id));
        this.close();
        this.state.refreshUnthanked();
        this.load();
      },
      error: e => { this.sending.set(false); this.toast.error(friendlyError(e)); },
    });
  }
}

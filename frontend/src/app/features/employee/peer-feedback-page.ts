// Peer Feedback: perf-season peer feedback drafted ONLY from how a teammate helped you, every claim cited.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Category, PeerCandidate, PeerFeedback } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { CategoryChip } from '../../shared/category';
import { CitationChip } from '../../shared/source';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-peer-feedback-page',
  imports: [Avatar, CategoryChip, CitationChip, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Peer feedback</h1>
    <p class="mt-1 text-sm text-stone-500">
      Perf season? Pick a teammate and get a draft built only from the times they helped <em>you</em> — every line linked to the real interaction.
    </p>

    <div class="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
      <!-- candidates -->
      <section>
        <div class="text-xs font-semibold uppercase tracking-wide text-stone-500">Teammates who helped you</div>
        <div class="mt-2 space-y-2">
          @if (candidates.loading() && !candidates.data()) { <div class="card p-4"><app-skeleton [rows]="5" /></div> }
          @if (candidates.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
          @if (candidates.data(); as list) {
            @for (c of list; track c.peer.id) {
              <button class="card flex w-full items-center gap-3 p-3 text-left transition hover:border-ink"
                      [class.ring-2]="selected() === c.peer.id" [class.ring-amber]="selected() === c.peer.id"
                      (click)="draftFor(c)">
                <app-avatar [person]="c.peer" [size]="40" />
                <div class="min-w-0 flex-1">
                  <div class="font-semibold text-stone-900">{{ c.peer.name }}</div>
                  <div class="text-xs text-stone-500">Helped you {{ c.interactions }} time{{ c.interactions === 1 ? '' : 's' }}</div>
                  <div class="mt-1 flex flex-wrap gap-1">
                    @for (cat of cats(c); track cat) { <app-category-chip [category]="cat" /> }
                  </div>
                </div>
                <span class="material-symbols-outlined text-stone-400">chevron_right</span>
              </button>
            } @empty {
              <div class="card"><app-empty-state icon="group" title="No direct help recorded yet" hint="When teammates unblock, review or mentor you in opted-in spaces, they'll show up here." /></div>
            }
          }
        </div>
      </section>

      <!-- draft -->
      <section>
        @if (!selected()) {
          <div class="card"><app-empty-state icon="rate_review" title="Pick a teammate" hint="We'll draft feedback from your shared history — you edit, then paste it into GRAD." /></div>
        }
        @if (draft.loading()) {
          <div class="card p-6">
            <div class="flex items-center gap-2 text-sm text-stone-500"><span class="material-symbols-outlined animate-spin text-amber">progress_activity</span>Reading your shared history and drafting…</div>
            <div class="mt-4"><app-skeleton [rows]="7" /></div>
          </div>
        }
        @if (draft.error(); as e) { <app-error-state [message]="e" (retry)="retry()" /> }
        @if (draft.data(); as d) {
          <article class="card p-6">
            <header class="flex items-start gap-3">
              <app-avatar [person]="d.peer" [size]="48" />
              <div class="flex-1">
                <h2 class="text-xl font-semibold text-ink">{{ d.title }}</h2>
                <p class="mt-1 text-sm text-stone-600">{{ d.summary }}</p>
              </div>
            </header>

            @for (s of d.sections; track s.title) {
              <h3 class="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">{{ s.title }}</h3>
              <ul class="mt-2 space-y-3">
                @for (c of s.claims; track $index) {
                  <li class="rounded-xl border border-line p-3">
                    <div class="text-sm leading-relaxed text-stone-800">{{ c.text }}</div>
                    <div class="mt-2 flex flex-wrap gap-1.5">@for (id of c.activity_ids; track id) { <app-citation-chip [id]="id" /> }</div>
                  </li>
                }
              </ul>
            }

            @if (d.growth) {
              <div class="mt-6 rounded-xl bg-amber-soft/60 p-4">
                <div class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink">
                  <span class="material-symbols-outlined text-base">lightbulb</span>One suggestion · your opinion, not evidence
                </div>
                <p class="mt-1 text-sm text-stone-800">{{ d.growth }}</p>
              </div>
            }

            <footer class="mt-6 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <span class="chip bg-emerald-50 text-emerald-800"><span class="material-symbols-outlined text-sm">verified</span>{{ d.citations_count }} citations from {{ d.evidence_count }} interactions</span>
              @if (d.unverified_removed > 0) {
                <span class="chip bg-rose-50 text-rose-800">{{ d.unverified_removed }} uncited claim{{ d.unverified_removed === 1 ? '' : 's' }} removed</span>
              }
              <span class="text-xs text-stone-400">{{ d.model === 'gemini' ? 'Drafted by Gemini' : 'Template draft' }} — edit before submitting</span>
              <button class="btn-amber ml-auto" (click)="copy(d)"><span class="material-symbols-outlined text-base">content_copy</span>Copy for GRAD</button>
            </footer>
          </article>
        }
      </section>
    </div>
  `,
})
export class PeerFeedbackPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);

  readonly candidates = new Loadable<PeerCandidate[]>();
  readonly draft = new Loadable<PeerFeedback>();
  readonly selected = signal<string | null>(null);

  constructor() { this.load(); }

  load() {
    const me = this.session.userId(); if (!me) return;
    this.candidates.load(this.api.peerCandidates(me), { keepData: true });
  }

  cats(c: PeerCandidate): Category[] {
    return Object.entries(c.categories).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => k as Category);
  }

  draftFor(c: PeerCandidate) {
    this.selected.set(c.peer.id);
    this.retry();
  }

  retry() {
    const me = this.session.userId(); const peer = this.selected(); if (!me || !peer) return;
    this.draft.load(this.api.peerFeedback(me, peer));
  }

  copy(d: PeerFeedback) {
    const lines = [d.title, '', d.summary];
    for (const s of d.sections) {
      lines.push('', s.title);
      for (const c of s.claims) lines.push(`• ${c.text} [${c.activity_ids.join(', ')}]`);
    }
    if (d.growth) lines.push('', 'One suggestion', d.growth);
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Copied — paste it into GRAD and make it yours'),
      () => this.toast.error('Could not copy to clipboard'),
    );
  }
}

// Manager review draft for a report: same Draft renderer as the promo packet, calibrated against level expectations.
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Draft, ReviewBiasCheck } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { DraftViewer } from '../../shared/draft-viewer';
import { CitationChip } from '../../shared/source';
import { ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { ReportPicker } from './report-picker';
import { downloadText } from '../../core/util/download';

@Component({
  selector: 'app-review-page',
  imports: [FormsModule, RouterLink, Avatar, DraftViewer, CitationChip, ErrorState, Skeleton, ReportPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!id()) {
      <h1 class="text-3xl font-bold tracking-tight text-ink">Review drafts</h1>
      <p class="mt-1 mb-6 text-sm text-stone-500">Pick a report. Every sentence in the draft is backed by a citation you can open.</p>
      <app-report-picker base="/manager/review" icon="description" />
    } @else {
      <div class="flex flex-wrap items-center gap-3">
        <a routerLink="/manager/review" class="rounded-lg p-1 text-stone-500 hover:bg-stone-100"><span class="material-symbols-outlined">arrow_back</span></a>
        <app-avatar [person]="person()" [size]="40" />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink">Review draft · {{ person()?.name ?? id() }}</h1>
          <p class="text-sm text-stone-500">{{ person()?.title }} · {{ person()?.level }}</p>
        </div>
        <div class="ml-auto flex gap-2">
          <a class="btn-ghost" [routerLink]="['/person', id()]"><span class="material-symbols-outlined text-base">person</span>Profile</a>
          @if (draft.data(); as d) {
            <button class="btn-ghost" (click)="copy(d.markdown)"><span class="material-symbols-outlined text-base">content_copy</span>Copy for Docs</button>
            <button class="btn-ghost" (click)="exportMd(d)"><span class="material-symbols-outlined text-base">download</span>Markdown</button>
          }
          <button class="btn-primary" (click)="generate()" [disabled]="draft.loading()">
            <span class="material-symbols-outlined text-base">{{ draft.data() ? 'refresh' : 'auto_awesome' }}</span>
            {{ draft.data() ? 'Regenerate' : 'Generate draft' }}
          </button>
        </div>
      </div>
      <div class="mt-4 flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-2.5 text-sm text-ink">
        <span class="material-symbols-outlined text-base">balance</span>
        <span><b>Calibration:</b> compared to level expectations — never to teammates. No scores, no ranking.</span>
      </div>
      <div class="mt-5">
        @if (draft.loading()) {
          <div class="card flex flex-col items-center gap-3 p-10 text-stone-600">
            <span class="material-symbols-outlined animate-spin text-3xl text-amber">progress_activity</span>
            <div class="font-medium">{{ step() }}</div>
          </div>
        }
        @if (draft.error(); as e) { <app-error-state [message]="e" (retry)="generate()" /> }
        @if (draft.data(); as d) { <app-draft-viewer [draft]="d" /> }
      </div>

      <!-- Review Language Bias & Evidence Lens -->
      <section class="card mt-6 p-6">
        <div class="flex flex-wrap items-center gap-2">
          <span class="material-symbols-outlined text-xl text-ink">policy</span>
          <div>
            <h2 class="text-lg font-semibold text-ink">Review language bias &amp; evidence lens</h2>
            <p class="text-xs text-stone-500">Catches vague or communal phrasing ("helpful", "supportive", "team player") and uncited claims before GRAD calibration, and suggests evidence-backed rewrites.</p>
          </div>
          <div class="ml-auto flex gap-2">
            <button class="btn-ghost text-xs" (click)="useSample()">Try biased sample</button>
            <button class="btn-amber text-xs" [disabled]="!auditText().trim() || lens.loading()" (click)="runLens()">
              <span class="material-symbols-outlined text-sm">fact_check</span>Check review text
            </button>
          </div>
        </div>
        <textarea rows="3" [ngModel]="auditText()" (ngModelChange)="auditText.set($event)"
          placeholder="Paste your GRAD review text here (or click 'Try biased sample')…"
          class="mt-3 w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-ink focus:outline-none"></textarea>

        @if (lens.loading()) { <div class="mt-3"><app-skeleton [rows]="3" /></div> }
        @if (lens.error(); as e) { <div class="mt-3"><app-error-state [message]="e" (retry)="runLens()" /></div> }
        @if (lens.data(); as res) {
          <div class="mt-4 flex flex-wrap items-center gap-2">
            <span class="chip bg-emerald-50 text-emerald-800">{{ res.cited_count }} cited</span>
            <span class="chip" [class]="res.uncited_count ? 'bg-amber-soft text-ink' : 'bg-stone-100 text-stone-600'">{{ res.uncited_count }} uncited</span>
            <span class="chip" [class]="res.communal_count ? 'bg-rose-50 text-rose-800' : 'bg-stone-100 text-stone-600'">{{ res.communal_count }} communal-framing</span>
            <span class="text-sm text-stone-600">{{ res.summary }}</span>
          </div>
          @if (res.findings.length) {
            <div class="mt-4 space-y-3">
              @for (f of res.findings; track $index) {
                <div class="rounded-xl border border-line p-4">
                  <div class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide"
                       [class]="f.issue_type === 'communal_framing' ? 'text-rose-700' : 'text-amber-700'">
                    <span class="material-symbols-outlined text-sm">{{ f.issue_type === 'communal_framing' ? 'warning' : 'link_off' }}</span>
                    {{ f.issue_type === 'communal_framing' ? 'Communal framing (' + f.matched_terms.join(', ') + ')' : 'Uncited claim' }}
                  </div>
                  <div class="mt-1 text-sm text-stone-500 line-through">{{ f.original }}</div>
                  <p class="mt-1 text-xs text-stone-600">{{ f.explanation }}</p>
                  <div class="mt-2 rounded-lg bg-emerald-50/70 p-2.5 text-sm text-stone-900">
                    <span class="font-semibold text-emerald-900">Suggested rewrite: </span>{{ f.suggested_rewrite }}
                  </div>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5">
                    @for (aid of f.activity_ids; track aid) { <app-citation-chip [id]="aid" /> }
                    <button class="btn-ghost ml-auto !py-1 text-xs" (click)="copy(f.suggested_rewrite)">
                      <span class="material-symbols-outlined text-sm">content_copy</span>Copy rewrite
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        }
      </section>
    }
  `,
})
export class ReviewPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);
  readonly id = input<string>();
  readonly draft = new Loadable<Draft>();
  readonly lens = new Loadable<ReviewBiasCheck>();
  readonly auditText = signal('');
  readonly person = computed(() => this.session.person(this.id()));
  readonly step = signal('');
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => {
        this.draft.cancel(); this.draft.data.set(null);
        this.lens.cancel(); this.lens.data.set(null); this.auditText.set('');
        if (id) this.generate();
      });
    });
    effect(() => { if (!this.draft.loading()) clearInterval(this.timer); });
  }

  generate() {
    const id = this.id(); if (!id) return;
    const steps = ['Collecting evidence…', 'Comparing to level expectations…', 'Verifying citations…'];
    let i = 0; this.step.set(steps[0]);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.step.set(steps[Math.min(++i, steps.length - 1)]), 1200);
    this.draft.load(this.api.reviewDraft(id), { keepData: true });
  }

  useSample() {
    const name = this.person()?.first_name ?? 'Priya';
    this.auditText.set(
      `${name} is always helpful, supportive, and a great team player.\nShe consistently delivers solid work on the payments platform.`,
    );
    this.runLens();
  }

  runLens() {
    const id = this.id(); const text = this.auditText().trim(); if (!id || !text) return;
    this.lens.load(this.api.reviewBiasCheck(id, text));
  }

  copy(md: string) { navigator.clipboard?.writeText(md).then(() => this.toast.success('Copied — paste into Docs')); }
  exportMd(d: Draft) { downloadText(`review-${d.person_id}.md`, d.markdown); }
}

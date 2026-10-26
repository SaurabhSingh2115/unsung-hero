// Manager review draft for a report: same Draft renderer as the promo packet, calibrated against level expectations.
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Draft } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { DraftViewer } from '../../shared/draft-viewer';
import { ErrorState } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { ReportPicker } from './report-picker';
import { downloadText } from '../../core/util/download';

@Component({
  selector: 'app-review-page',
  imports: [RouterLink, Avatar, DraftViewer, ErrorState, ReportPicker],
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
    }
  `,
})
export class ReviewPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);
  readonly id = input<string>();
  readonly draft = new Loadable<Draft>();
  readonly person = computed(() => this.session.person(this.id()));
  readonly step = signal('');
  private timer?: ReturnType<typeof setInterval>;

  constructor() {
    effect(() => { const id = this.id(); untracked(() => { this.draft.cancel(); this.draft.data.set(null); if (id) this.generate(); }); });
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

  copy(md: string) { navigator.clipboard?.writeText(md).then(() => this.toast.success('Copied — paste into Docs')); }
  exportMd(d: Draft) { downloadText(`review-${d.person_id}.md`, d.markdown); }
}

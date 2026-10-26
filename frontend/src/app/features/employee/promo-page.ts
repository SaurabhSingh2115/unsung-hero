// Promotion packet: evidence-backed case for the next level, every claim cited, plus gap analysis.
import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Draft } from '../../core/models';
import { downloadText } from '../../core/util/download';
import { Loadable } from '../../core/util/loadable';
import { DraftViewer, GapAnalysisCard } from '../../shared/draft-viewer';
import { ErrorState } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-promo-page',
  imports: [DraftViewer, GapAnalysisCard, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">Promotion packet</h1>
        <p class="mt-1 text-sm text-stone-500">Your case for {{ nextLevel() }}, built only from cited evidence. Uncited claims are removed before you see them.</p>
      </div>
      @if (draft.data(); as d) {
        <div class="ml-auto flex flex-wrap gap-2">
          <button class="btn-ghost" (click)="build()" [disabled]="draft.loading()"><span class="material-symbols-outlined text-base">refresh</span>Regenerate</button>
          <button class="btn-ghost" (click)="exportMd(d)"><span class="material-symbols-outlined text-base">download</span>Export Markdown</button>
          <button class="btn-primary" (click)="copy(d)"><span class="material-symbols-outlined text-base">content_copy</span>Copy for Docs</button>
        </div>
      }
    </div>

    @if (!draft.data() && !draft.loading() && !draft.error()) {
      <div class="card mt-6 flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-soft">
          <span class="material-symbols-outlined text-4xl text-amber">rocket_launch</span>
        </div>
        <div class="max-w-lg text-stone-600">Unsung maps your evidence — including the glue work that usually goes unseen — to {{ nextLevel() }} expectations, and shows where the gaps are.</div>
        <button class="btn-amber !px-5 !py-3 text-base" (click)="build()"><span class="material-symbols-outlined">auto_awesome</span>Build my promotion case</button>
      </div>
    }

    @if (draft.loading()) {
      <div class="card mt-6 flex flex-col items-center gap-4 px-6 py-14">
        <span class="material-symbols-outlined animate-spin text-4xl text-amber">progress_activity</span>
        <ol class="space-y-1.5 text-sm">
          @for (s of steps; track s; let i = $index) {
            <li class="flex items-center gap-2" [class.text-stone-300]="i > step()" [class.text-ink]="i === step()" [class.text-emerald-600]="i < step()">
              <span class="material-symbols-outlined text-base">{{ i < step() ? 'check_circle' : i === step() ? 'pending' : 'radio_button_unchecked' }}</span>{{ s }}
            </li>
          }
        </ol>
      </div>
    }
    @if (draft.error(); as e) { <div class="mt-6"><app-error-state [message]="e" (retry)="build()" /></div> }

    @if (draft.data(); as d) {
      <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]" [class.opacity-60]="draft.loading()">
        <app-draft-viewer [draft]="d" />
        <div class="space-y-4">
          @if (d.gap_analysis; as g) { <app-gap-analysis [gap]="g" /> }
          <div class="card p-4 text-xs text-stone-500">
            <div class="flex items-center gap-1.5 font-medium text-stone-700"><span class="material-symbols-outlined text-base">memory</span>
              Model: {{ d.model === 'gemini' ? 'Gemini' : 'Heuristic (no Gemini key)' }}</div>
            <p class="mt-1">Every claim was checked server-side against your evidence. Click any citation chip to see the original source.</p>
          </div>
        </div>
      </div>
    }
  `,
})
export class PromoPage implements OnDestroy {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);
  readonly draft = new Loadable<Draft>();
  readonly step = signal(0);
  private timer?: ReturnType<typeof setInterval>;

  readonly nextLevel = () => {
    const lvl = this.session.user()?.level ?? 'L4';
    const n = parseInt(lvl.replace(/\D/g, ''), 10);
    return isNaN(n) ? 'the next level' : `L${n + 1}`;
  };
  get steps() { return ['Collecting evidence…', `Mapping to ${this.nextLevel()} expectations…`, 'Verifying citations…']; }

  build() {
    const me = this.session.userId(); if (!me) return;
    this.step.set(0);
    clearInterval(this.timer);
    this.timer = setInterval(() => this.step.update(s => Math.min(s + 1, 2)), 1300);
    this.draft.load(this.api.promoPacket(me), { keepData: true, onNext: () => clearInterval(this.timer) });
  }

  exportMd(d: Draft) { downloadText(`promotion-packet-${d.person_id}.md`, d.markdown); }
  copy(d: Draft) {
    navigator.clipboard?.writeText(d.markdown).then(
      () => this.toast.success('Copied — paste into Google Docs'),
      () => this.toast.error('Clipboard not available'),
    );
  }
  ngOnDestroy() { clearInterval(this.timer); }
}

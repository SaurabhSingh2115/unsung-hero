// Draft renderer (promo packet + review draft) with citation chips, plus gap analysis card.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Draft, GapAnalysis } from '../core/models';
import { CitationChip } from './source';
import { RelDatePipe } from './pipes';

@Component({
  selector: 'app-draft-viewer',
  imports: [CitationChip, RelDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let d = draft();
    <article class="card p-6">
      <div class="flex flex-wrap items-center gap-2">
        <span class="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
          <span class="material-symbols-outlined mr-1" style="font-size:14px">verified</span>
          ✓ 0 unverified claims · {{ d.citations_count }} citations
        </span>
        @if (d.unverified_removed > 0) {
          <span class="chip bg-amber-soft text-ink ring-1 ring-amber/40">
            {{ d.unverified_removed }} uncited claim{{ d.unverified_removed === 1 ? '' : 's' }} removed
          </span>
        }
        <span class="ml-auto text-xs text-stone-400">
          {{ d.model === 'gemini' ? 'Written by Gemini' : 'Heuristic template' }} · {{ d.generated_at | relDate }}
        </span>
      </div>
      <h2 class="mt-3 text-2xl font-bold tracking-tight text-ink">{{ d.title }}</h2>
      <p class="mt-2 leading-relaxed text-stone-700">{{ d.summary }}</p>
      @for (s of d.sections; track $index) {
        <section class="mt-6">
          <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">{{ s.title }}</h3>
          <ul class="space-y-2.5">
            @for (c of s.claims; track $index) {
              <li class="flex gap-2 leading-relaxed text-stone-800">
                <span class="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber"></span>
                <span>{{ c.text }}
                  @for (id of c.activity_ids; track id) { <app-citation-chip [id]="id" class="ml-1" /> }
                </span>
              </li>
            }
          </ul>
        </section>
      }
    </article>
  `,
})
export class DraftViewer {
  readonly draft = input.required<Draft>();
}

@Component({
  selector: 'app-gap-analysis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = gap();
    <div class="card p-5">
      <div class="flex items-center gap-2">
        <span class="material-symbols-outlined text-ink">trending_up</span>
        <h3 class="font-semibold text-ink">Gap analysis</h3>
        <span class="ml-auto chip bg-indigo-50 text-ink">{{ g.current_level }} → {{ g.next_level }}</span>
      </div>
      <p class="mt-1 text-xs text-stone-500">Compared to {{ g.next_level }} expectations — never to teammates.</p>
      <div class="mt-4 space-y-4">
        @for (d of g.dimensions; track d.dimension) {
          <div>
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-stone-800">{{ d.dimension }}</span>
              @if (d.met) {
                <span class="text-xs font-medium text-emerald-700">✓ Met</span>
              } @else {
                <span class="text-xs font-medium text-amber-700">Gap · {{ d.required - d.score }} pts</span>
              }
            </div>
            <div class="relative mt-1.5 h-2.5 rounded-full bg-stone-100">
              <div class="h-full rounded-full" [class]="d.met ? 'bg-emerald-500' : 'bg-amber'" [style.width.%]="clamp(d.score)"></div>
              <div class="absolute -top-1 h-4.5 w-0.5 rounded bg-ink" [style.left.%]="clamp(d.required)" [attr.title]="'Required: ' + d.required"></div>
            </div>
            <div class="mt-1 text-xs text-stone-500">{{ d.expectation }}</div>
            @if (!d.met && d.suggestion) {
              <div class="mt-1 flex gap-1 rounded-lg bg-amber-soft px-2 py-1 text-xs text-stone-700">
                <span class="material-symbols-outlined text-amber" style="font-size:14px">lightbulb</span>{{ d.suggestion }}
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class GapAnalysisCard {
  readonly gap = input.required<GapAnalysis>();
  clamp(v: number) { return Math.max(0, Math.min(100, v)); }
}

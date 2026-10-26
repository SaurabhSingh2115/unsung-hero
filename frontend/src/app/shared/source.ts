// Source record rendering (used by /source/:id page and the citation side panel) + citation chip + panel.
import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Injectable, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { SourceRecord } from '../core/models';
import { Loadable } from '../core/util/loadable';
import { parseLink } from '../core/util/link';
import { PersonChip } from './avatar';
import { CategoryChip, SOURCE_LABEL, SourceIcon } from './category';
import { ShortDatePipe } from './pipes';
import { ErrorState, Skeleton } from './states';

/** Which activity is open in the global citation side panel. */
@Injectable({ providedIn: 'root' })
export class SourcePanelService {
  readonly activityId = signal<string | null>(null);
  open(id: string) { this.activityId.set(id); }
  close() { this.activityId.set(null); }
}

type Raw = Record<string, unknown>;

@Component({
  selector: 'app-source-detail',
  imports: [JsonPipe, RouterLink, PersonChip, CategoryChip, SourceIcon, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = record();
    @let a = r.activity;
    <div class="space-y-4">
      <div class="card p-4">
        <div class="flex items-center gap-2 text-sm text-stone-500">
          <app-source-icon [source]="a.source" />
          <span>{{ sourceLabel() }}</span><span>·</span><span>{{ a.timestamp | shortDate }}</span>
          <span class="ml-auto font-mono text-xs text-stone-400">{{ a.id }}</span>
        </div>
        <p class="mt-2 text-[15px] leading-relaxed text-stone-900">{{ a.text }}</p>
        <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
          <app-person-chip [id]="a.actor_id" />
          @if (a.target_ids.length) {
            <span class="material-symbols-outlined text-sm">arrow_forward</span>
            @for (t of a.target_ids; track t) { <app-person-chip [id]="t" /> }
          }
          @if (a.project_name) { <span class="chip bg-indigo-50 text-ink">{{ a.project_name }}</span> }
        </div>
        @if (link().path.startsWith('/chat')) {
          <a class="btn-ghost mt-3" [routerLink]="link().path" [queryParams]="link().queryParams">
            <span class="material-symbols-outlined text-base">forum</span>Open in Chat
          </a>
        }
      </div>

      @if (r.classification; as c) {
        <div class="card p-4">
          <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">How Unsung classified this</div>
          <div class="flex flex-wrap items-center gap-2 text-sm">
            <app-category-chip [category]="c.category" />
            <span class="text-stone-600">confidence {{ (c.confidence * 100).toFixed(0) }}%</span>
            <span class="chip" [class]="c.model === 'gemini' ? 'bg-indigo-50 text-ink' : 'bg-stone-100 text-stone-600'">
              {{ c.model === 'gemini' ? 'Gemini' : 'Heuristic' }}
            </span>
            @if (c.asks_for_help) { <span class="chip bg-amber-soft text-ink">asks for help</span> }
          </div>
          <p class="mt-2 text-sm italic text-stone-600">“{{ c.rationale }}”</p>
        </div>
      }

      <div class="card p-4">
        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Original record</div>
        @switch (a.source) {
          @case ('code_review') {
            <div class="text-sm">
              <div class="font-medium text-stone-900">{{ s('pr_title') ?? s('title') ?? 'Pull request' }}</div>
              @if (s('repo')) { <div class="text-xs text-stone-500">{{ s('repo') }} {{ s('pr_number') ? '#' + s('pr_number') : '' }}</div> }
              @for (c of list('comments'); track $index) {
                <div class="mt-2 rounded-lg border-l-4 border-cat-review bg-stone-50 px-3 py-2">
                  <div class="text-xs text-stone-500">{{ str(c, 'author') }} @if (str(c, 'file')) { · <span class="font-mono">{{ str(c, 'file') }}</span> }</div>
                  <div>{{ str(c, 'text') ?? str(c, 'body') ?? '' }}</div>
                </div>
              }
            </div>
          }
          @case ('ticket') {
            <div class="text-sm">
              <div class="font-medium text-stone-900">{{ s('key') ?? s('ticket_id') ?? '' }} {{ s('title') ?? s('summary') ?? '' }}</div>
              <div class="mt-1 flex gap-2 text-xs">
                @if (s('status')) { <span class="chip bg-stone-100">{{ s('status') }}</span> }
                @if (s('priority')) { <span class="chip bg-rose-50 text-rose-700">{{ s('priority') }}</span> }
              </div>
              @if (s('description')) { <p class="mt-2 text-stone-700">{{ s('description') }}</p> }
            </div>
          }
          @case ('doc_comment') {
            <div class="text-sm">
              <div class="font-medium text-stone-900">{{ s('doc_title') ?? s('title') ?? 'Document' }}</div>
              @if (s('quoted_text') ?? s('anchor')) {
                <blockquote class="mt-2 border-l-4 border-cat-documentation bg-amber-soft/50 px-3 py-1 italic">{{ s('quoted_text') ?? s('anchor') }}</blockquote>
              }
              @if (s('comment')) { <p class="mt-2">{{ s('comment') }}</p> }
            </div>
          }
          @case ('calendar') {
            <div class="text-sm">
              <div class="font-medium text-stone-900">{{ s('title') ?? s('summary') ?? 'Event' }}</div>
              <div class="text-xs text-stone-500">{{ s('start') ?? '' }} {{ s('duration_minutes') ? '· ' + s('duration_minutes') + ' min' : '' }}</div>
            </div>
          }
        }
        <details class="mt-3" [open]="a.source === 'chat' || a.source === 'manual' || a.source === 'launch_doc' || a.source === 'recognition'">
          <summary class="cursor-pointer text-xs text-stone-500">Raw JSON</summary>
          <pre class="mt-2 max-h-80 overflow-auto rounded-lg bg-stone-900 p-3 text-xs leading-relaxed text-stone-100">{{ r.raw | json }}</pre>
        </details>
      </div>
    </div>
  `,
})
export class SourceDetail {
  readonly record = input.required<SourceRecord>();
  readonly link = computed(() => parseLink(this.record().activity.link));
  readonly sourceLabel = computed(() => SOURCE_LABEL[this.record().activity.source]);

  s(key: string): string | null {
    const v = (this.record().raw as Raw)?.[key];
    return v === undefined || v === null ? null : String(v);
  }
  list(key: string): Raw[] {
    const v = (this.record().raw as Raw)?.[key];
    return Array.isArray(v) ? (v as Raw[]) : [];
  }
  str(o: Raw, key: string): string | null {
    const v = o?.[key];
    return v === undefined || v === null ? null : String(v);
  }
}

/** Indigo citation chip; opens the source side panel. */
@Component({
  selector: 'app-citation-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" (click)="open($event)"
      class="inline-flex items-center gap-0.5 rounded-md bg-indigo-50 px-1.5 py-0.5 align-baseline font-mono text-[11px] font-medium text-ink ring-1 ring-indigo-200 transition hover:bg-ink hover:text-white"
      [attr.title]="'Open source ' + id()">
      <span class="material-symbols-outlined" style="font-size:12px">link</span>{{ id() }}
    </button>
  `,
})
export class CitationChip {
  private panel = inject(SourcePanelService);
  readonly id = input.required<string>();
  open(e: Event) { e.stopPropagation(); this.panel.open(this.id()); }
}

/** Slide-over panel showing the SourceRecord for the open citation. Rendered once in the shell. */
@Component({
  selector: 'app-source-panel',
  imports: [SourceDetail, Skeleton, ErrorState, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (panel.activityId(); as id) {
      <div class="fixed inset-0 z-40 bg-ink/20 backdrop-blur-[1px]" (click)="panel.close()"></div>
      <aside class="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-cream shadow-2xl" role="dialog" aria-label="Source">
        <header class="flex items-center gap-2 border-b border-line bg-white px-5 py-3">
          <span class="material-symbols-outlined text-ink">verified</span>
          <div class="font-semibold text-ink">Evidence <span class="font-mono text-sm text-stone-500">{{ id }}</span></div>
          <a class="btn-ghost ml-auto !py-1 text-xs" [routerLink]="['/source', id]" (click)="panel.close()">Full page</a>
          <button class="rounded-lg p-1 hover:bg-stone-100" (click)="panel.close()" aria-label="Close">
            <span class="material-symbols-outlined">close</span>
          </button>
        </header>
        <div class="flex-1 overflow-y-auto p-5">
          @if (rec.loading()) { <app-skeleton [rows]="6" /> }
          @if (rec.error(); as e) { <app-error-state [message]="e" (retry)="load(id)" /> }
          @if (rec.data(); as r) { <app-source-detail [record]="r" /> }
        </div>
      </aside>
    }
  `,
})
export class SourcePanel {
  readonly panel = inject(SourcePanelService);
  private api = inject(ApiService);
  readonly rec = new Loadable<SourceRecord>();

  constructor() {
    effect(() => {
      const id = this.panel.activityId();
      untracked(() => { if (id) this.load(id); });
    });
  }
  load(id: string) { this.rec.load(this.api.activity(id)); }
}

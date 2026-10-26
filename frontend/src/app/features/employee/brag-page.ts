// Brag doc: month-by-month evidence, with a toggle to translate technical work into business impact.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { BragDoc, Translation } from '../../core/models';
import { Loadable, friendlyError } from '../../core/util/loadable';
import { CategoryChip, SourceIcon } from '../../shared/category';
import { ShortDatePipe } from '../../shared/pipes';
import { CitationChip } from '../../shared/source';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-brag-page',
  imports: [CategoryChip, SourceIcon, ShortDatePipe, CitationChip, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">Brag doc</h1>
        <p class="mt-1 text-sm text-stone-500">Kept up to date for you, from your evidence. Ready for reviews, promo cases and 1:1s.</p>
      </div>
      <div class="ml-auto flex items-center gap-1 rounded-xl border border-stone-300 bg-white p-1 text-sm" role="tablist">
        <button class="rounded-lg px-3 py-1.5 font-medium" [class]="!business() ? 'bg-ink text-white' : 'text-stone-600'" (click)="setBusiness(false)">Technical</button>
        <button class="rounded-lg px-3 py-1.5 font-medium" [class]="business() ? 'bg-ink text-white' : 'text-stone-600'" (click)="setBusiness(true)">
          @if (translating()) { <span class="material-symbols-outlined animate-spin align-[-4px] text-base">progress_activity</span> }
          Business impact
        </button>
      </div>
    </div>

    <div class="mt-6 space-y-6">
      @if (doc.loading()) { <div class="card p-6"><app-skeleton [rows]="8" /></div> }
      @if (doc.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (doc.data(); as d) {
        @for (m of d.months; track m.month) {
          <section class="card p-5">
            <h2 class="mb-3 flex items-center gap-2 text-lg font-semibold text-ink">{{ m.label }}
              <span class="text-xs font-normal text-stone-400">{{ m.items.length }} items</span></h2>
            <ul class="space-y-3">
              @for (it of m.items; track it.activity.id) {
                <li class="flex gap-3">
                  <app-source-icon [source]="it.activity.source" />
                  <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2">
                      <app-category-chip [category]="it.classification?.category" />
                      <span class="text-xs text-stone-400">{{ it.activity.timestamp | shortDate }}</span>
                      @if (it.activity.project_name) { <span class="text-xs text-stone-400">· {{ it.activity.project_name }}</span> }
                    </div>
                    @if (business() && tx()[it.activity.id]; as t) {
                      <p class="mt-1 text-sm font-medium leading-relaxed text-stone-900">{{ t.business_impact }}
                        <app-citation-chip [id]="it.activity.id" class="ml-1" /></p>
                      <p class="mt-0.5 text-xs text-stone-400 line-through decoration-stone-300">{{ t.original }}</p>
                    } @else {
                      <p class="mt-1 text-sm leading-relaxed text-stone-800">{{ it.activity.text }}
                        <app-citation-chip [id]="it.activity.id" class="ml-1" /></p>
                    }
                  </div>
                </li>
              }
            </ul>
          </section>
        } @empty {
          <div class="card"><app-empty-state icon="article" title="Nothing to brag about yet" hint="Log an activity or chat in an opted-in space." /></div>
        }
      }
    </div>
  `,
})
export class BragPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);
  readonly doc = new Loadable<BragDoc>();
  readonly business = signal(false);
  readonly translating = signal(false);
  readonly tx = signal<Record<string, Translation>>({});
  readonly allIds = computed(() => (this.doc.data()?.months ?? []).flatMap(m => m.items.map(i => i.activity.id)));

  constructor() { this.load(); }
  load() { const me = this.session.userId(); if (me) this.doc.load(this.api.bragDoc(me)); }

  setBusiness(on: boolean) {
    this.business.set(on);
    if (!on) return;
    const me = this.session.userId(); if (!me) return;
    const missing = this.allIds().filter(id => !this.tx()[id]);
    if (!missing.length) return;
    this.translating.set(true);
    this.api.translate(me, missing.slice(0, 40)).subscribe({
      next: list => {
        this.translating.set(false);
        this.tx.update(cur => { const next = { ...cur }; for (const t of list) next[t.activity_id] = t; return next; });
      },
      error: e => { this.translating.set(false); this.toast.error(friendlyError(e)); },
    });
  }
}

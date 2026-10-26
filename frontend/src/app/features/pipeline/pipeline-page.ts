// Data pipeline: how Chat + other sources become evidence. Auto-refreshes every 5s; "Sync now" pulls new chat messages.
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { PipelineStatus } from '../../core/models';
import { Loadable, friendlyError } from '../../core/util/loadable';
import { SOURCE_ICON, SOURCE_LABEL } from '../../shared/category';
import { RelDatePipe } from '../../shared/pipes';
import { ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-pipeline-page',
  imports: [RouterLink, RelDatePipe, Skeleton, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-center gap-3">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">Data pipeline</h1>
        <p class="mt-1 text-sm text-stone-500">Where Unsung's evidence comes from. LLMs classify; plain code computes every metric.</p>
      </div>
      <div class="ml-auto flex items-center gap-3">
        @if (lastNew() !== null) {
          <span class="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">{{ lastNew() }} new activit{{ lastNew() === 1 ? 'y' : 'ies' }} ingested</span>
        }
        <span class="text-xs text-stone-400">auto-refresh 5s</span>
        <button class="btn-primary" (click)="sync()" [disabled]="syncing()">
          <span class="material-symbols-outlined text-base" [class.animate-spin]="syncing()">sync</span>Sync now
        </button>
      </div>
    </div>

    <!-- diagram -->
    <div class="card mt-6 overflow-x-auto p-5">
      <div class="flex min-w-[760px] items-stretch gap-2">
        @for (s of stages(); track s.title; let last = $last) {
          <div class="flex-1 rounded-2xl border p-3.5" [class]="s.cls">
            <div class="flex items-center gap-2"><span class="material-symbols-outlined" [class]="s.iconCls">{{ s.icon }}</span>
              <span class="font-semibold text-stone-900">{{ s.title }}</span></div>
            <div class="mt-1 text-xs text-stone-600">{{ s.desc }}</div>
            @if (s.stat) { <div class="mt-2 text-lg font-bold text-ink">{{ s.stat }}</div> }
          </div>
          @if (!last) { <div class="flex items-center text-stone-300"><span class="material-symbols-outlined">arrow_forward</span></div> }
        }
      </div>
    </div>

    @if (status.loading() && !status.data()) { <div class="card mt-5 p-6"><app-skeleton [rows]="6" /></div> }
    @if (status.error() && !status.data()) { <div class="mt-5"><app-error-state [message]="status.error()!" (retry)="refresh()" /></div> }
    @if (status.data(); as p) {
      <div class="mt-5 grid gap-5 lg:grid-cols-3">
        <section class="card p-5 lg:col-span-1">
          <h2 class="font-semibold text-ink">Sources</h2>
          <table class="mt-3 w-full text-sm">
            <tbody>
              @for (s of p.sources; track s.source) {
                <tr class="border-b border-stone-100 last:border-0">
                  <td class="py-2"><span class="material-symbols-outlined mr-2 text-base text-stone-500">{{ icon(s.source) }}</span>{{ label(s.source) }}</td>
                  <td class="py-2 text-right font-semibold tabular-nums text-ink">{{ s.events }}</td>
                </tr>
              }
            </tbody>
          </table>
          <div class="mt-3 flex justify-between border-t border-line pt-2 text-sm"><span class="text-stone-500">Total activities</span><b class="text-ink">{{ p.total_activities }}</b></div>
        </section>

        <section class="card p-5">
          <h2 class="flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-gchat-green">forum</span>Chat ingestion</h2>
          <dl class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-stone-500">Spaces opted in</dt><dd class="font-semibold text-ink">{{ p.chat.spaces_opted_in }} / {{ p.chat.spaces_total }}</dd></div>
            <div class="flex justify-between"><dt class="text-stone-500">Messages ingested</dt><dd class="font-semibold text-ink">{{ p.chat.messages_ingested }} / {{ p.chat.messages_total }}</dd></div>
            <div class="h-2 rounded-full bg-stone-100"><div class="h-full rounded-full bg-gchat-green" [style.width.%]="p.chat.messages_total ? (p.chat.messages_ingested / p.chat.messages_total) * 100 : 0"></div></div>
            <div class="flex justify-between"><dt class="text-stone-500">Last synced</dt><dd class="text-stone-700">{{ p.chat.last_synced_at | relDate }}</dd></div>
          </dl>
          <p class="mt-3 text-xs text-stone-500">Spaces that aren't opted in (like <i>#random</i>) are never read.</p>
          <a routerLink="/chat" class="btn-ghost mt-3 !py-1.5 text-xs">Open Chat ↗</a>
        </section>

        <section class="card p-5">
          <h2 class="flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-ink-soft">auto_awesome</span>Classifier</h2>
          <dl class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-stone-500">Classified</dt><dd class="font-semibold text-ink">{{ p.classified }} / {{ p.total_activities }}</dd></div>
            <div class="flex justify-between"><dt class="text-stone-500">By Gemini</dt><dd class="font-semibold text-ink">{{ p.by_model.gemini }}</dd></div>
            <div class="flex justify-between"><dt class="text-stone-500">By heuristic</dt><dd class="font-semibold text-ink">{{ p.by_model.heuristic }}</dd></div>
            <div class="flex h-2 overflow-hidden rounded-full bg-stone-100">
              <div class="bg-ink" [style.width.%]="pct(p.by_model.gemini, p.classified)"></div>
              <div class="bg-stone-400" [style.width.%]="pct(p.by_model.heuristic, p.classified)"></div>
            </div>
            <div class="flex justify-between"><dt class="text-stone-500">Eval precision</dt>
              <dd class="font-semibold text-ink">{{ p.classifier_eval ? (p.classifier_eval.precision * 100).toFixed(0) + '% (n=' + p.classifier_eval.n + ')' : '—' }}</dd></div>
          </dl>
          <p class="mt-3 text-xs text-stone-500">{{ p.gemini_enabled ? 'Gemini is enabled.' : 'No Gemini key — deterministic heuristics are used.' }}</p>
        </section>
      </div>
    }
  `,
})
export class PipelinePage {
  private api = inject(ApiService);
  private toast = inject(ToastService);
  readonly status = new Loadable<PipelineStatus>();
  readonly syncing = signal(false);
  readonly lastNew = signal<number | null>(null);

  readonly stages = computed(() => {
    const p = this.status.data();
    return [
      { title: 'Chat app', icon: 'forum', iconCls: 'text-gchat-green', cls: 'border-emerald-200 bg-emerald-50/50', desc: 'Team conversations in opted-in spaces', stat: p ? `${p.chat.messages_total} msgs` : '' },
      { title: 'Ingestion', icon: 'input', iconCls: 'text-stone-600', cls: 'border-stone-200 bg-stone-50', desc: 'Chat + code review, docs, tickets, calendar', stat: p ? `${p.total_activities} activities` : '' },
      { title: 'Gemini enrichment', icon: 'auto_awesome', iconCls: 'text-ink-soft', cls: 'border-indigo-200 bg-indigo-50/60', desc: 'Classify glue work with confidence + rationale', stat: p ? `${p.classified} classified` : '' },
      { title: 'Metrics (code)', icon: 'functions', iconCls: 'text-stone-600', cls: 'border-stone-200 bg-stone-50', desc: 'Deterministic: help graph, gaps, bridge score', stat: '' },
      { title: 'Unsung', icon: 'star', iconCls: 'text-amber', cls: 'border-amber/50 bg-amber-soft', desc: 'Profiles, alerts, thanks, promo packets', stat: '' },
    ];
  });

  constructor() {
    this.refresh();
    const t = setInterval(() => this.refresh(true), 5000);
    inject(DestroyRef).onDestroy(() => clearInterval(t));
  }

  refresh(silent = false) {
    if (silent && (this.status.loading() || this.syncing())) return;
    this.status.load(this.api.pipelineStatus(), { keepData: true });
  }

  sync() {
    this.syncing.set(true);
    this.api.pipelineSync().subscribe({
      next: r => {
        this.syncing.set(false);
        this.lastNew.set(r.new_activities);
        this.status.data.set(r);
        this.toast.success(`${r.new_activities} new activit${r.new_activities === 1 ? 'y' : 'ies'} ingested`);
      },
      error: e => { this.syncing.set(false); this.toast.error(friendlyError(e)); },
    });
  }

  icon(s: string) { return SOURCE_ICON[s as keyof typeof SOURCE_ICON] ?? 'description'; }
  label(s: string) { return SOURCE_LABEL[s as keyof typeof SOURCE_LABEL] ?? s; }
  pct(a: number, b: number) { return b ? (a / b) * 100 : 0; }
}

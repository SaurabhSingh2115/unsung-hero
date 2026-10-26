// Manager home: team stats, force-directed help graph, alerts.
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { Alert, TeamGraph, TeamStats } from '../../core/models';
import { AppStateService } from '../../core/util/app-state.service';
import { Loadable } from '../../core/util/loadable';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { AlertList } from './alert-list';
import { TeamGraphChart, gapColor } from './team-graph-chart';

@Component({
  selector: 'app-team-page',
  imports: [RouterLink, TeamGraphChart, AlertList, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap items-end gap-4">
      <div>
        <h1 class="text-3xl font-bold tracking-tight text-ink">Team overview</h1>
        <p class="mt-1 text-sm text-stone-500">{{ stats.data()?.team_name ?? 'Payments Platform' }} · who helps whom, and whether it's being seen.</p>
      </div>
      <div class="ml-auto grid grid-cols-2 gap-3 md:grid-cols-4">
        @if (stats.data(); as s) {
          <div class="card px-4 py-3"><div class="text-xs text-stone-500">Glue work share</div><div class="text-2xl font-bold text-ink">{{ (s.glue_work_share * 100).toFixed(0) }}%</div></div>
          <div class="card px-4 py-3"><div class="text-xs text-stone-500">Avg time-to-unblock</div><div class="text-2xl font-bold text-ink">{{ s.avg_time_to_unblock_hours === null ? '—' : s.avg_time_to_unblock_hours.toFixed(1) + 'h' }}</div></div>
          <div class="card px-4 py-3"><div class="text-xs text-stone-500">Follow-through</div><div class="text-2xl font-bold text-ink">{{ s.follow_through_rate === null ? '—' : (s.follow_through_rate * 100).toFixed(0) + '%' }}</div></div>
          <div class="card px-4 py-3"><div class="text-xs text-stone-500">Activities · {{ s.people_count }} people</div><div class="text-2xl font-bold text-ink">{{ s.activity_count }}</div></div>
        } @else if (stats.loading()) {
          @for (i of [1, 2, 3, 4]; track i) { <div class="card h-[68px] w-36 animate-pulse bg-stone-100"></div> }
        }
      </div>
    </div>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
      <section class="card p-5">
        <div class="flex items-center gap-2">
          <h2 class="font-semibold text-ink">Help graph</h2>
          <span class="text-xs text-stone-400">arrow = helper → helped · thicker = more help</span>
        </div>
        @if (graph.loading()) { <div class="mt-4"><app-skeleton [rows]="8" /></div> }
        @if (graph.error(); as e) { <div class="mt-4"><app-error-state [message]="e" (retry)="load()" /></div> }
        @if (graph.data(); as g) {
          @if (g.nodes.length) {
            <app-team-graph [graph]="g" />
          } @else {
            <app-empty-state icon="hub" title="No help activity yet" hint="Opt-in spaces in Chat feed this graph." />
          }
        }
        <div class="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs text-stone-500">
          <span>Node size = glue work</span>
          <span class="inline-flex items-center gap-1.5">Recognition gap
            <span class="h-2.5 w-24 rounded-full" [style.background]="legendGradient"></span>
            <span>seen</span>→<span>unseen</span>
          </span>
          <span class="inline-flex items-center gap-1"><span class="h-3 w-3 rounded-full ring-2 ring-amber shadow-[0_0_8px_#f2b544]"></span>Most unacknowledged help</span>
          <span class="ml-auto">Not a ranking — click a person to see the evidence.</span>
        </div>
      </section>

      <section class="card flex flex-col p-5">
        <div class="mb-3 flex items-center">
          <h2 class="font-semibold text-ink">Alerts</h2>
          <a routerLink="/manager/alerts" class="ml-auto text-xs font-medium text-ink-soft hover:underline">See all</a>
        </div>
        @if (alerts.loading()) { <app-skeleton [rows]="6" /> }
        @if (alerts.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
        @if (alerts.data(); as a) {
          @if (a.length) { <app-alert-list [alerts]="a.slice(0, 6)" [compact]="true" /> }
          @else { <app-empty-state icon="check_circle" title="No alerts" hint="Glue work is being seen. Nice." /> }
        }
      </section>
    </div>
  `,
})
export class TeamPage {
  private api = inject(ApiService);
  private state = inject(AppStateService);
  readonly graph = new Loadable<TeamGraph>();
  readonly alerts = new Loadable<Alert[]>();
  readonly stats = new Loadable<TeamStats>();
  readonly legendGradient = `linear-gradient(90deg, ${gapColor(0)}, ${gapColor(0.25)}, ${gapColor(0.5)})`;

  constructor() { this.load(); }

  load() {
    const t = this.state.teamId;
    this.graph.load(this.api.teamGraph(t));
    this.alerts.load(this.api.teamAlerts(t));
    this.stats.load(this.api.teamStats(t));
  }
}

// All team alerts grouped by type.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { Alert, AlertType } from '../../core/models';
import { AppStateService } from '../../core/util/app-state.service';
import { Loadable } from '../../core/util/loadable';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { ALERT_META, AlertList } from './alert-list';

const ORDER: AlertType[] = ['recognition_gap', 'ghost_credit', 'load_imbalance', 'bus_factor', 'burnout'];

@Component({
  selector: 'app-alerts-page',
  imports: [AlertList, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Alerts</h1>
    <p class="mt-1 text-sm text-stone-500">Signals worth a conversation — each one links to the evidence behind it. Burnout is a signal, never a score.</p>
    <div class="mt-6">
      @if (alerts.loading()) { <div class="card p-6"><app-skeleton [rows]="8" /></div> }
      @if (alerts.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (alerts.data()) {
        @for (g of groups(); track g.type) {
          <section class="mb-7">
            <h2 class="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
              <span class="material-symbols-outlined text-base">{{ g.icon }}</span>{{ g.label }}
              <span class="rounded-full bg-stone-200 px-1.5 text-[11px] text-stone-700">{{ g.items.length }}</span>
            </h2>
            <div class="max-w-3xl"><app-alert-list [alerts]="g.items" /></div>
          </section>
        } @empty {
          <div class="card"><app-empty-state icon="check_circle" title="No alerts right now" /></div>
        }
      }
    </div>
  `,
})
export class AlertsPage {
  private api = inject(ApiService);
  private state = inject(AppStateService);
  readonly alerts = new Loadable<Alert[]>();

  readonly groups = computed(() => {
    const list = this.alerts.data() ?? [];
    const types = [...ORDER, ...new Set(list.map(a => a.type).filter(t => !ORDER.includes(t)))];
    return types
      .map(type => ({ type, ...(ALERT_META[type] ?? { label: type, icon: 'info' }), items: list.filter(a => a.type === type) }))
      .filter(g => g.items.length);
  });

  constructor() { this.load(); }
  load() { this.alerts.load(this.api.teamAlerts(this.state.teamId)); }
}

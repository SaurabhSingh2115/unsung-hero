// Alert card list (team page right column + alerts page).
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Alert, AlertType } from '../../core/models';
import { PersonChip } from '../../shared/avatar';

export const ALERT_META: Record<AlertType, { label: string; icon: string }> = {
  recognition_gap: { label: 'Recognition gap', icon: 'volunteer_activism' },
  load_imbalance: { label: 'Load imbalance', icon: 'balance' },
  bus_factor: { label: 'Bus factor', icon: 'warning' },
  ghost_credit: { label: 'Ghost credit', icon: 'visibility' },
  burnout: { label: 'Burnout signal', icon: 'local_fire_department' },
};

const SEV: Record<Alert['severity'], string> = {
  high: 'border-amber bg-amber-soft',
  medium: 'border-orange-200 bg-orange-50/40',
  low: 'border-stone-200 bg-white',
};

@Component({
  selector: 'app-alert-list',
  imports: [RouterLink, PersonChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-2.5">
      @for (a of alerts(); track a.id) {
        <div class="rounded-2xl border p-3.5" [class]="sev(a)">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide"
               [class]="a.severity === 'high' ? 'text-amber-700' : a.severity === 'medium' ? 'text-orange-700' : 'text-stone-500'">
            <span class="material-symbols-outlined" style="font-size:15px">{{ meta(a).icon }}</span>
            {{ meta(a).label }} · {{ a.severity }}
          </div>
          <div class="mt-1 font-semibold leading-snug text-stone-900">{{ a.title }}</div>
          @if (!compact()) { <p class="mt-1 text-sm text-stone-600">{{ a.detail }}</p> }
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            @for (pid of a.person_ids; track pid) {
              <a [routerLink]="['/person', pid]"><app-person-chip [id]="pid" /></a>
            }
            @if (a.person_ids.length) {
              <a [routerLink]="['/person', a.person_ids[0]]" class="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-ink-soft hover:underline">
                {{ a.evidence_ids.length }} evidence <span class="material-symbols-outlined" style="font-size:14px">arrow_forward</span>
              </a>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class AlertList {
  readonly alerts = input.required<Alert[]>();
  readonly compact = input(false);
  sev(a: Alert) { return SEV[a.severity]; }
  meta(a: Alert) { return ALERT_META[a.type] ?? { label: a.type, icon: 'info' }; }
}

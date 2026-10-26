// Bias check: recognition per unit of help by group (remote vs office), with small groups suppressed.
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ApiService } from '../../core/api/api.service';
import { BiasCheck } from '../../core/models';
import { AppStateService } from '../../core/util/app-state.service';
import { Loadable } from '../../core/util/loadable';
import { ErrorState, Skeleton } from '../../shared/states';

@Component({
  selector: 'app-bias-page',
  imports: [Skeleton, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Bias check</h1>
    <p class="mt-1 text-sm text-stone-500">Is help being recognised equally across groups? Aggregates only — groups smaller than the privacy threshold are hidden.</p>
    <div class="mt-6 max-w-3xl">
      @if (bias.loading()) { <div class="card p-6"><app-skeleton [rows]="5" /></div> }
      @if (bias.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (bias.data(); as b) {
        <div class="card p-6">
          <div class="text-sm font-semibold text-stone-700">Thanks received per help given</div>
          <div class="mt-4 space-y-5">
            @for (g of b.groups; track g.group) {
              <div>
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium capitalize text-stone-900">{{ g.group }} <span class="font-normal text-stone-400">· {{ g.size }} people</span></span>
                  @if (!g.suppressed) {
                    <span class="font-semibold text-ink">{{ g.thanks_per_help === null ? '—' : g.thanks_per_help.toFixed(2) }}</span>
                  }
                </div>
                @if (g.suppressed) {
                  <div class="mt-1.5 flex items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50 px-3 py-2.5 text-sm text-stone-500">
                    <span class="material-symbols-outlined text-base">lock</span>
                    Hidden: fewer than {{ b.min_group_size }} people
                  </div>
                } @else {
                  <div class="mt-1.5 h-4 rounded-full bg-stone-100">
                    <div class="h-full rounded-full transition-all" [class]="g.group === 'remote' ? 'bg-amber' : 'bg-ink'"
                         [style.width.%]="((g.thanks_per_help ?? 0) / maxRatio()) * 100"></div>
                  </div>
                  <div class="mt-1 text-xs text-stone-500">{{ g.help_given }} help given · {{ g.thanks_received }} thanks received</div>
                }
              </div>
            }
          </div>
          <div class="mt-6 flex gap-2 rounded-xl bg-indigo-50/70 px-4 py-3 text-sm text-ink">
            <span class="material-symbols-outlined text-base">info</span><span>{{ b.note }}</span>
          </div>
        </div>
      }
    </div>
  `,
})
export class BiasPage {
  private api = inject(ApiService);
  private state = inject(AppStateService);
  readonly bias = new Loadable<BiasCheck>();
  readonly maxRatio = computed(() => Math.max(0.01, ...(this.bias.data()?.groups ?? []).map(g => g.thanks_per_help ?? 0)));
  constructor() { this.load(); }
  load() { this.bias.load(this.api.biasCheck(this.state.teamId)); }
}

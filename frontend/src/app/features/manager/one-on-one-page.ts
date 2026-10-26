// 1:1 prep for a report: wins, blockers, unthanked help nudge, unacknowledged help, burnout signal, open items.
import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { OneOnOne } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { CategoryChip } from '../../shared/category';
import { EvidenceRow } from '../../shared/evidence-row';
import { ShortDatePipe } from '../../shared/pipes';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { parseLink } from '../../core/util/link';
import { ReportPicker } from './report-picker';

@Component({
  selector: 'app-one-on-one-page',
  imports: [RouterLink, Avatar, CategoryChip, EvidenceRow, ShortDatePipe, Skeleton, ErrorState, EmptyState, ReportPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!id()) {
      <h1 class="text-3xl font-bold tracking-tight text-ink">1:1 Prep</h1>
      <p class="mt-1 mb-6 text-sm text-stone-500">Talking points from the last few weeks — wins to celebrate, blockers to clear, help to recognise.</p>
      <app-report-picker base="/manager/one-on-one" icon="groups" />
    } @else {
      @if (data.loading()) { <div class="card p-6"><app-skeleton [rows]="8" /></div> }
      @if (data.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (data.data(); as o) {
        <div class="flex flex-wrap items-center gap-3">
          <a routerLink="/manager/one-on-one" class="rounded-lg p-1 text-stone-500 hover:bg-stone-100"><span class="material-symbols-outlined">arrow_back</span></a>
          <app-avatar [person]="o.person" [size]="44" />
          <div>
            <h1 class="text-2xl font-bold tracking-tight text-ink">1:1 with {{ o.person.first_name }}</h1>
            <p class="text-sm text-stone-500">{{ o.person.title }} · {{ o.person.level }}</p>
          </div>
          <a class="btn-ghost ml-auto" [routerLink]="['/person', o.person.id]"><span class="material-symbols-outlined text-base">person</span>Profile</a>
        </div>

        @if (o.burnout?.flag) {
          <div class="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-900">
            <span class="material-symbols-outlined text-rose-500">local_fire_department</span>
            <div><div class="font-semibold">Burnout signal — worth a gentle check-in</div>
              <div class="text-sm">{{ o.burnout?.reason }}</div>
              <div class="mt-1 text-xs text-rose-700/80">This is an alert, never a score.</div></div>
          </div>
        }

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          <div class="card p-4"><div class="text-xs text-stone-500">Wins</div><div class="text-2xl font-bold text-ink">{{ o.wins.length }}</div></div>
          <div class="card p-4 ring-1 ring-amber/50"><div class="text-xs text-stone-500">Their help that went unacknowledged</div>
            <div class="text-2xl font-bold text-amber-700">{{ o.help_unacknowledged }}</div></div>
          <div class="card p-4"><div class="text-xs text-stone-500">Open action items</div><div class="text-2xl font-bold text-ink">{{ o.open_action_items }}</div></div>
        </div>

        <div class="mt-5 grid gap-5 lg:grid-cols-2">
          <section class="card p-5">
            <h2 class="mb-2 flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-emerald-600">celebration</span>Wins to celebrate</h2>
            @for (w of o.wins; track w.activity.id) { <app-evidence-row [item]="w" [ownerId]="o.person.id" /> }
            @empty { <app-empty-state icon="celebration" title="No wins logged recently" /> }
          </section>
          <section class="card p-5">
            <h2 class="mb-2 flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-rose-500">block</span>Blockers</h2>
            @for (b of o.blockers; track b.activity.id) { <app-evidence-row [item]="b" [ownerId]="o.person.id" /> }
            @empty { <app-empty-state icon="check" title="No open blockers" /> }
          </section>
        </div>

        <section class="card mt-5 p-5">
          <h2 class="flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-amber">volunteer_activism</span>Help {{ o.person.first_name }} received but hasn't thanked</h2>
          <p class="mb-3 text-sm text-stone-500">A gentle nudge: suggest {{ o.person.first_name }} recognise these people (Say Thanks makes it one click).</p>
          <div class="grid gap-3 md:grid-cols-2">
            @for (u of o.unthanked_help; track u.helper.id) {
              <div class="rounded-xl border border-line p-3">
                <div class="flex items-center gap-2">
                  <app-avatar [person]="u.helper" [size]="30" />
                  <div class="text-sm"><b>{{ u.helper.first_name }}</b> helped {{ o.person.first_name }} {{ u.count }}×</div>
                </div>
                <ul class="mt-2 space-y-1">
                  @for (a of u.activities.slice(0, 3); track a.id) {
                    <li class="flex items-center gap-2 text-xs text-stone-600">
                      <app-category-chip [category]="a.category" />
                      <a class="truncate hover:underline" [routerLink]="lp(a.link).path" [queryParams]="lp(a.link).queryParams">{{ a.text }}</a>
                      <span class="ml-auto shrink-0 text-stone-400">{{ a.timestamp | shortDate }}</span>
                    </li>
                  }
                </ul>
              </div>
            } @empty {
              <app-empty-state icon="favorite" title="All help has been thanked" />
            }
          </div>
        </section>
      }
    }
  `,
})
export class OneOnOnePage {
  private api = inject(ApiService);
  readonly id = input<string>();
  readonly data = new Loadable<OneOnOne>();
  constructor() { effect(() => { const id = this.id(); untracked(() => { if (id) this.load(); }); }); }
  load() { const id = this.id(); if (id) this.data.load(this.api.oneOnOne(id)); }
  lp(link: string) { return parseLink(link); }
}

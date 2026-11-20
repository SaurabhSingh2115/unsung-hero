// Leave simulator: "what if X is out?" Dependency, load re-routing, knowledge with no backup, and a plan.
// Plain graph math over the consented help graph (no AI). Manager-only.
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { AbsenceLoadShift, AbsenceSim, Category, LoadStatus } from '../../core/models';
import { AppStateService } from '../../core/util/app-state.service';
import { parseLink } from '../../core/util/link';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { CategoryChip } from '../../shared/category';
import { CitationChip } from '../../shared/source';
import { ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';
import { ReportPicker } from './report-picker';

const OVERLOAD = 3; // × team median, same threshold as the backend
const STATUS: Record<LoadStatus, { label: string; bar: string; chip: string }> = {
  ok: { label: 'Has capacity', bar: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-800' },
  busy: { label: 'Busy', bar: 'bg-amber', chip: 'bg-amber-soft text-ink' },
  overloaded: { label: 'Overloaded', bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-800' },
};

@Component({
  selector: 'app-resilience-page',
  imports: [RouterLink, Avatar, CategoryChip, CitationChip, Skeleton, ErrorState, ReportPicker],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!id()) {
      <h1 class="text-3xl font-bold tracking-tight text-ink">Leave simulator</h1>
      <p class="mt-1 mb-6 max-w-3xl text-sm text-stone-500">
        Parental leave, vacation, a transfer, an on-call week… Pick a teammate to see what breaks if they're out,
        <em>before</em> it happens. Plain graph math over the team's help graph, no AI.
      </p>
      <app-report-picker base="/manager/resilience" icon="flight_takeoff" />
    } @else {
      <div class="flex flex-wrap items-center gap-3">
        <a routerLink="/manager/resilience" class="rounded-lg p-1 text-stone-500 hover:bg-stone-100"><span class="material-symbols-outlined">arrow_back</span></a>
        <app-avatar [person]="person()" [size]="40" />
        <div>
          <h1 class="text-2xl font-bold tracking-tight text-ink">What if {{ person()?.first_name ?? id() }} is out?</h1>
          <p class="text-sm text-stone-500">{{ person()?.title }} · {{ person()?.level }}</p>
        </div>
        @if (sim.data(); as s) {
          <button class="btn-ghost ml-auto" (click)="copyPlan(s)"><span class="material-symbols-outlined text-base">content_copy</span>Copy coverage plan</button>
        }
      </div>

      @if (sim.loading()) { <div class="card mt-5 p-6"><app-skeleton [rows]="8" /></div> }
      @if (sim.error(); as e) { <div class="mt-5"><app-error-state [message]="e" (retry)="load()" /></div> }

      @if (sim.data(); as s) {
        <div class="mt-5 flex items-center gap-3 rounded-2xl bg-ink px-5 py-4 text-white">
          <span class="material-symbols-outlined text-3xl text-amber">flight_takeoff</span>
          <div class="text-lg font-semibold">{{ s.headline }}</div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div class="card p-4"><div class="text-3xl font-bold text-ink">{{ pct(s.help_share_lost) }}</div><div class="text-sm text-stone-500">of the team's help ({{ s.absent_help }} of {{ s.team_help_total }})</div></div>
          <div class="card p-4"><div class="text-3xl font-bold text-ink">{{ s.people_affected }}</div><div class="text-sm text-stone-500">teammates lose support</div></div>
          <div class="card p-4"><div class="text-3xl font-bold text-ink">{{ s.orphaned_count }}</div><div class="text-sm text-stone-500">help items nobody else has covered</div></div>
          <div class="card p-4" [class.border-rose-300]="overloaded().length">
            <div class="text-3xl font-bold" [class]="overloaded().length ? 'text-rose-600' : 'text-emerald-700'">{{ overloaded().length ? overloaded().join(', ') : 'Nobody' }}</div>
            <div class="text-sm text-stone-500">would become overloaded covering</div>
          </div>
        </div>

        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <!-- who loses support -->
          <section class="card p-5">
            <h2 class="font-semibold text-ink">Who loses support</h2>
            <p class="text-xs text-stone-500">Share of each person's help that came from {{ s.absent.first_name }}.</p>
            <ul class="mt-4 space-y-4">
              @for (a of s.affected; track a.person.id) {
                <li>
                  <div class="flex items-center gap-2 text-sm">
                    <app-avatar [person]="a.person" [size]="28" />
                    <span class="font-medium text-stone-900">{{ a.person.first_name }}</span>
                    <span class="text-xs text-stone-500">{{ a.help_from_absent }} of {{ a.total_help_received }} helps</span>
                    @if (a.stranded) { <span class="chip ml-auto bg-rose-50 text-rose-800">No other helper</span> }
                    @else { <span class="ml-auto font-semibold text-ink">{{ pct(a.dependency) }}</span> }
                  </div>
                  <div class="mt-1.5 h-2.5 rounded-full bg-stone-100">
                    <div class="h-full rounded-full" [class]="a.dependency >= 0.6 ? 'bg-rose-500' : 'bg-amber'" [style.width.%]="a.dependency * 100"></div>
                  </div>
                  @if (a.other_helpers.length) { <div class="mt-1 text-xs text-stone-500">Others who help {{ a.person.first_name }}: {{ a.other_helpers.join(', ') }}</div> }
                </li>
              }
            </ul>
          </section>

          <!-- who absorbs the load -->
          <section class="card p-5">
            <h2 class="font-semibold text-ink">Who absorbs the load</h2>
            <p class="text-xs text-stone-500">{{ s.absent.first_name }}'s help re-routed to each person's other past helpers · × team median (dashed line = overload).</p>
            <ul class="mt-4 space-y-4">
              @for (l of s.load_shift; track l.person.id) {
                <li>
                  <div class="flex items-center gap-2 text-sm">
                    <app-avatar [person]="l.person" [size]="28" />
                    <span class="font-medium text-stone-900">{{ l.person.first_name }}</span>
                    <span class="text-xs text-stone-500">{{ l.before_ratio }}× → <b class="text-stone-800">{{ l.after_ratio }}×</b></span>
                    <span class="chip ml-auto {{ status(l).chip }}">{{ status(l).label }}</span>
                  </div>
                  <div class="relative mt-1.5 h-2.5 rounded-full bg-stone-100">
                    <div class="absolute inset-y-0 left-0 rounded-full {{ status(l).bar }}" [style.width.%]="w(l.after_ratio)"></div>
                    <div class="absolute inset-y-0 left-0 rounded-full bg-stone-400/70" [style.width.%]="w(l.before_ratio)"></div>
                    <div class="absolute -inset-y-1 border-l-2 border-dashed border-rose-400" [style.left.%]="w(overloadLine)"></div>
                  </div>
                </li>
              }
            </ul>
          </section>
        </div>

        <!-- knowledge with no backup -->
        <section class="card mt-6 p-5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-ink">Knowledge only {{ s.absent.first_name }} has shared</h2>
            @for (c of cats(s); track c[0]) { <span class="chip bg-stone-100 text-stone-700">{{ c[1] }} {{ c[0] }}</span> }
            @if (s.solo_incidents) { <span class="chip bg-rose-50 text-rose-800">{{ s.solo_incidents }} incidents with no teammate covering</span> }
          </div>
          <p class="text-xs text-stone-500">Help items where no one else on the team has ever helped on the same topic. "Learned by" = who already received the explanation: the natural successors.</p>
          <ul class="mt-4 space-y-2.5">
            @for (k of s.knowledge_items; track k.activity.id) {
              <li class="flex items-center gap-2 text-sm">
                <app-category-chip [category]="k.activity.category" />
                <a class="min-w-0 flex-1 truncate text-stone-700 hover:underline" [routerLink]="lp(k.activity.link).path" [queryParams]="lp(k.activity.link).queryParams" [attr.title]="k.activity.text">{{ k.activity.text }}</a>
                <app-citation-chip [id]="k.activity.id" />
                @if (k.learned_by.length) {
                  <span class="flex shrink-0 items-center gap-1 text-xs text-stone-500">learned by @for (p of k.learned_by; track p.id) { <app-avatar [person]="p" [size]="22" /> }</span>
                }
              </li>
            }
          </ul>
        </section>

        <!-- plan -->
        <section class="card mt-6 p-5">
          <h2 class="font-semibold text-ink">Suggested coverage plan</h2>
          <ol class="mt-3 space-y-2.5">
            @for (r of s.recommendations; track $index) {
              <li class="flex gap-3 text-sm text-stone-800">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-soft text-xs font-bold text-ink">{{ $index + 1 }}</span>
                <span>{{ r }}</span>
              </li>
            } @empty {
              <li class="text-sm text-stone-500">No major risks: the team can cover for {{ s.absent.first_name }}.</li>
            }
          </ol>
        </section>
      }
    }
  `,
})
export class ResiliencePage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private state = inject(AppStateService);
  private toast = inject(ToastService);

  readonly id = input<string>();
  readonly sim = new Loadable<AbsenceSim>();
  readonly person = computed(() => this.session.person(this.id()));
  readonly overloadLine = OVERLOAD;
  readonly scale = computed(() => Math.max(OVERLOAD * 1.25, ...(this.sim.data()?.load_shift ?? []).map(l => l.after_ratio)));
  readonly overloaded = computed(() =>
    (this.sim.data()?.load_shift ?? [])
      .filter(l => l.status_after === 'overloaded' && l.status_before !== 'overloaded')
      .map(l => l.person.first_name),
  );

  constructor() {
    effect(() => { const id = this.id(); untracked(() => { this.sim.cancel(); this.sim.data.set(null); if (id) this.load(); }); });
  }

  load() {
    const id = this.id(); if (!id) return;
    this.sim.load(this.api.absenceSim(this.state.teamId, id));
  }

  pct(v: number) { return `${Math.round(v * 100)}%`; }
  w(ratio: number) { return Math.min(100, (ratio / this.scale()) * 100); }
  status(l: AbsenceLoadShift) { return STATUS[l.status_after]; }
  lp(link: string) { return parseLink(link); }
  cats(s: AbsenceSim): [Category, number][] {
    return (Object.entries(s.orphaned_by_category) as [Category, number][]).sort((a, b) => b[1] - a[1]);
  }

  copyPlan(s: AbsenceSim) {
    const lines = [s.headline, '', ...s.recommendations.map((r, i) => `${i + 1}. ${r}`)];
    navigator.clipboard?.writeText(lines.join('\n')).then(
      () => this.toast.success('Coverage plan copied'),
      () => this.toast.error('Could not copy to clipboard'),
    );
  }
}

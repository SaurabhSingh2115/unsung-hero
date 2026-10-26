// Profile (shared): /me (self) and /person/:id (manager viewing a report). Same data either way —
// the employee can preview exactly what the manager sees, and hide / annotate / dispute evidence.
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Annotation, Category, Dimension, EvidenceItem, Profile, QuadrantPoint } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { BubbleChart } from '../../shared/bubble-chart';
import { ALL_CATEGORIES, CATEGORY_LABEL } from '../../shared/category';
import { EvidenceRow } from '../../shared/evidence-row';
import { RelDatePipe } from '../../shared/pipes';
import { RadarChart } from '../../shared/radar-chart';
import { CitationChip } from '../../shared/source';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';

const DIMENSIONS: Dimension[] = ['Impact', 'Collaboration', 'Knowledge', 'Quality', 'Leadership', 'Growth'];

@Component({
  selector: 'app-profile-page',
  imports: [RouterLink, Avatar, BubbleChart, EvidenceRow, RadarChart, CitationChip, RelDatePipe, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (previewOn()) {
      <div class="mb-4 flex items-center gap-3 rounded-2xl bg-ink px-5 py-3 text-white shadow">
        <span class="material-symbols-outlined text-amber">visibility</span>
        <div class="flex-1 text-sm"><b>Preview: this is exactly what {{ managerName() }} sees.</b>
          <span class="text-white/70"> Hidden items are removed; your notes and disputes are shown alongside.</span></div>
        <button class="btn-amber !py-1.5" (click)="setPreview(false)">Exit preview</button>
      </div>
    }

    @if (profile.loading() && !profile.data()) { <div class="card p-6"><app-skeleton [rows]="6" /></div> }
    @if (profile.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }

    @if (profile.data(); as p) {
      <!-- header -->
      <div class="card flex flex-wrap items-center gap-4 p-5">
        <app-avatar [person]="p.person" [size]="64" />
        <div class="min-w-0">
          <h1 class="text-2xl font-bold tracking-tight text-ink">{{ p.person.name }}</h1>
          <div class="text-sm text-stone-600">{{ p.person.title }} · {{ p.person.level }}</div>
          <div class="mt-0.5 flex items-center gap-1 text-xs text-stone-500">
            <span class="material-symbols-outlined" style="font-size:14px">{{ p.person.location === 'remote' ? 'home' : 'apartment' }}</span>
            {{ p.person.location === 'remote' ? 'Remote' : 'Office' }} · {{ p.person.city }}
            @if (!p.person.opted_in) { <span class="chip ml-2 bg-stone-100 text-stone-600">Not opted in</span> }
          </div>
        </div>
        <div class="ml-auto flex flex-wrap gap-2">
          @if (isSelf()) {
            <button class="btn-primary" (click)="setPreview(!previewOn())">
              <span class="material-symbols-outlined text-base">{{ previewOn() ? 'visibility_off' : 'visibility' }}</span>
              {{ previewOn() ? 'Back to my view' : 'What my manager sees' }}
            </button>
          }
          @if (viewerIsManager() && !isSelf()) {
            <a class="btn-primary" [routerLink]="['/manager/review', p.person.id]"><span class="material-symbols-outlined text-base">description</span>Review draft</a>
            <a class="btn-ghost" [routerLink]="['/manager/one-on-one', p.person.id]"><span class="material-symbols-outlined text-base">groups</span>1:1 prep</a>
          }
        </div>
      </div>

      <!-- stat strip -->
      @let s = p.stats;
      <div class="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">Help given</div><div class="text-xl font-bold text-ink">{{ s.help_given }}</div></div>
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">People helped</div><div class="text-xl font-bold text-ink">{{ s.people_helped }}</div></div>
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">Thanks received</div><div class="text-xl font-bold text-ink">{{ s.thanks_received }}</div></div>
        <div class="card px-3 py-2.5" [class.ring-2]="s.unacknowledged_pct >= 0.5" [class.ring-amber]="s.unacknowledged_pct >= 0.5">
          <div class="text-[11px] text-stone-500">Unacknowledged</div><div class="text-xl font-bold" [class]="s.unacknowledged_pct >= 0.5 ? 'text-amber-700' : 'text-ink'">{{ (s.unacknowledged_pct * 100).toFixed(0) }}%</div></div>
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">Glue share</div><div class="text-xl font-bold text-ink">{{ (s.glue_share * 100).toFixed(0) }}%</div></div>
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">Time-to-unblock</div><div class="text-xl font-bold text-ink">{{ s.avg_time_to_unblock_hours === null ? '—' : s.avg_time_to_unblock_hours.toFixed(1) + 'h' }}</div></div>
        <div class="card px-3 py-2.5"><div class="text-[11px] text-stone-500">Follow-through</div><div class="text-xl font-bold text-ink">{{ s.follow_through_rate === null ? '—' : (s.follow_through_rate * 100).toFixed(0) + '%' }}</div></div>
        <div class="card px-3 py-2.5" title="Credit for work others shipped thanks to this person's help"><div class="text-[11px] text-stone-500">Ripple credit · bridge</div><div class="text-xl font-bold text-ink">{{ s.ripple_credit }} · {{ s.bridge_score.toFixed(2) }}</div></div>
      </div>

      <!-- charts -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="card p-5">
          <div class="flex items-center"><h2 class="font-semibold text-ink">Contribution shape</h2>
            <span class="ml-auto text-xs text-stone-400">6 dimensions · no overall score</span></div>
          @if (p.radar.length) {
            <app-radar-chart [dims]="p.radar" [selected]="dimension()" (picked)="dimension.set($event)" />
          } @else { <app-empty-state icon="radar" title="Not enough evidence yet" /> }
        </section>
        <section class="card p-5">
          <div class="flex items-center"><h2 class="font-semibold text-ink">Impact vs effort</h2>
            <span class="ml-auto text-xs text-stone-400">click a project to filter evidence</span></div>
          @if (p.quadrant.length) {
            <app-bubble-chart [points]="p.quadrant" [selected]="project()?.project_id ?? null" (picked)="project.set($event)" />
          } @else { <app-empty-state icon="bubble_chart" title="No project work yet" /> }
        </section>
      </div>

      <div class="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        <!-- evidence timeline -->
        <section class="card p-5">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="font-semibold text-ink">Evidence timeline</h2>
            <span class="text-xs text-stone-400">{{ filtered().length }} of {{ evidence.data()?.length ?? 0 }}</span>
            <div class="ml-auto flex flex-wrap items-center gap-2">
              <select class="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm" [value]="dimension() ?? ''"
                      (change)="dimension.set($any($event.target).value || null)" aria-label="Filter by dimension">
                <option value="">All dimensions</option>
                @for (d of dims; track d) { <option [value]="d" [selected]="d === dimension()">{{ d }}</option> }
              </select>
              <select class="rounded-lg border border-stone-300 bg-white px-2 py-1 text-sm" [value]="category() ?? ''"
                      (change)="category.set($any($event.target).value || null)" aria-label="Filter by category">
                <option value="">All categories</option>
                @for (c of cats; track c) { <option [value]="c" [selected]="c === category()">{{ catLabel[c] }}</option> }
              </select>
            </div>
          </div>
          @if (dimension() || category() || project()) {
            <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
              @if (dimension()) { <button class="chip bg-ink text-white" (click)="dimension.set(null)">{{ dimension() }} ✕</button> }
              @if (category()) { <button class="chip bg-ink text-white" (click)="category.set(null)">{{ catLabel[category()!] }} ✕</button> }
              @if (project(); as pr) { <button class="chip bg-amber text-ink" (click)="project.set(null)">{{ pr.project_name }} ✕</button> }
            </div>
          }
          @if (editable()) {
            <p class="mt-2 text-xs text-stone-500">You control this: <span class="material-symbols-outlined align-[-3px]" style="font-size:14px">visibility</span> hide from manager ·
              <span class="material-symbols-outlined align-[-3px]" style="font-size:14px">chat_bubble</span> add context ·
              <span class="material-symbols-outlined align-[-3px]" style="font-size:14px">flag</span> dispute a classification.</p>
          }
          <div class="mt-2 -mx-2 divide-y divide-stone-100">
            @if (evidence.loading() && !evidence.data()) { <div class="p-3"><app-skeleton [rows]="6" /></div> }
            @if (evidence.error(); as e) { <app-error-state [message]="e" (retry)="loadEvidence()" /> }
            @for (item of filtered(); track item.activity.id) {
              <app-evidence-row [item]="item" [ownerId]="p.person.id" [editable]="editable()" (annotated)="onAnnotated($event)" />
            } @empty {
              @if (evidence.data()) { <app-empty-state icon="filter_alt_off" title="No evidence matches these filters" /> }
            }
          </div>
        </section>

        <!-- recognition -->
        <section class="card self-start p-5">
          <h2 class="flex items-center gap-2 font-semibold text-ink"><span class="material-symbols-outlined text-amber">favorite</span>Recognition received</h2>
          <div class="mt-3 space-y-3">
            @for (r of p.recognition_received; track r.id) {
              <div class="rounded-xl bg-stone-50 p-3">
                <div class="flex items-center gap-2 text-xs text-stone-500">
                  <app-avatar [id]="r.from_id" [size]="22" />
                  <span class="font-medium text-stone-700">{{ name(r.from_id) }}</span>
                  <span class="chip bg-amber-soft text-ink">{{ r.type === 'peer_bonus' ? 'Peer bonus' : r.type === 'kudos' ? 'Kudos' : 'Chat thanks' }}</span>
                  <span class="ml-auto">{{ r.sent_at | relDate }}</span>
                </div>
                <p class="mt-1.5 text-sm text-stone-700">{{ r.message }}</p>
                @if (r.activity_refs.length) {
                  <div class="mt-1.5 flex flex-wrap gap-1">@for (a of r.activity_refs; track a) { <app-citation-chip [id]="a" /> }</div>
                }
              </div>
            } @empty {
              <app-empty-state icon="favorite_border" title="No recognition yet" hint="That's the gap Unsung is here to close." />
            }
          </div>
        </section>
      </div>
    }
  `,
})
export class ProfilePage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private router = inject(Router);

  /** Route param for /person/:id (absent on /me). */
  readonly id = input<string>();
  /** Query param ?preview=1 on /me. */
  readonly preview = input<string>();

  readonly profile = new Loadable<Profile>();
  readonly evidence = new Loadable<EvidenceItem[]>();
  readonly previewOn = signal(false);
  readonly dimension = signal<Dimension | null>(null);
  readonly category = signal<Category | null>(null);
  readonly project = signal<QuadrantPoint | null>(null);

  readonly dims = DIMENSIONS;
  readonly cats = ALL_CATEGORIES;
  readonly catLabel = CATEGORY_LABEL;

  readonly personId = computed(() => this.id() ?? this.session.userId() ?? '');
  readonly isSelf = computed(() => this.personId() === this.session.userId());
  readonly viewerIsManager = computed(() => this.session.isManager());
  readonly editable = computed(() => this.isSelf() && !this.previewOn());
  readonly managerName = computed(() => {
    const me = this.session.person(this.personId());
    return this.session.person(me?.manager_id)?.first_name ?? 'your manager';
  });

  readonly filtered = computed(() => {
    const dim = this.dimension(), cat = this.category(), proj = this.project();
    const ids = proj ? new Set(proj.activity_ids) : null;
    return (this.evidence.data() ?? []).filter(e =>
      (!dim || e.dimensions.includes(dim)) &&
      (!cat || e.classification?.category === cat) &&
      (!ids || ids.has(e.activity.id)));
  });

  constructor() {
    effect(() => { this.previewOn.set(this.preview() === '1' || this.preview() === 'true'); });
    effect(() => {
      this.personId(); this.previewOn();
      untracked(() => { this.dimension.set(null); this.category.set(null); this.project.set(null); this.load(); });
    });
  }

  load() {
    const id = this.personId(); if (!id) return;
    const asMgr = this.isSelf() && this.previewOn();
    this.profile.load(this.api.profile(id, asMgr), { keepData: this.profile.data()?.person.id === id });
    this.loadEvidence();
  }

  loadEvidence() {
    const id = this.personId(); if (!id) return;
    const asMgr = this.isSelf() && this.previewOn();
    this.evidence.load(this.api.evidence(id, { asManager: asMgr }), { keepData: false });
  }

  setPreview(on: boolean) {
    this.router.navigate([], { queryParams: { preview: on ? '1' : null }, queryParamsHandling: 'merge', replaceUrl: true });
    this.previewOn.set(on);
  }

  onAnnotated(a: Annotation) {
    this.evidence.data.update(list => (list ?? []).map(e => e.activity.id === a.activity_id ? { ...e, annotation: a } : e));
  }

  name(id: string) { return this.session.person(id)?.name ?? id; }
}

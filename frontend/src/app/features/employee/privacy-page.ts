// Privacy & control: opt-in, hidden / annotated / disputed items with undo, and the "same view" preview.
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Annotation, EvidenceItem } from '../../core/models';
import { Loadable, friendlyError } from '../../core/util/loadable';
import { CategoryChip } from '../../shared/category';
import { ShortDatePipe } from '../../shared/pipes';
import { ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

@Component({
  selector: 'app-privacy-page',
  imports: [RouterLink, CategoryChip, ShortDatePipe, Skeleton, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Privacy &amp; control</h1>
    <p class="mt-1 text-sm text-stone-500">Your data, your call. Your manager sees exactly what you can preview here — nothing more.</p>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
      <div class="space-y-5">
        <div class="card flex items-center gap-4 p-5">
          <span class="material-symbols-outlined text-3xl text-ink">shield_person</span>
          <div class="flex-1">
            <div class="font-semibold text-stone-900">Share my glue work with Unsung</div>
            <div class="text-sm text-stone-500">When off, your activity isn't used for profiles, alerts, or your manager's views.</div>
          </div>
          <button role="switch" [attr.aria-checked]="optedIn()" (click)="toggleOptIn()" [disabled]="savingOpt()"
                  class="relative h-7 w-12 shrink-0 rounded-full transition" [class]="optedIn() ? 'bg-ink' : 'bg-stone-300'">
            <span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" [style.left.px]="optedIn() ? 26 : 4"></span>
          </button>
        </div>

        @if (ev.loading()) { <div class="card p-6"><app-skeleton [rows]="5" /></div> }
        @if (ev.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
        @if (ev.data()) {
          @for (group of groups(); track group.key) {
            <section class="card p-5">
              <h2 class="flex items-center gap-2 font-semibold text-ink">
                <span class="material-symbols-outlined text-base">{{ group.icon }}</span>{{ group.title }}
                <span class="rounded-full bg-stone-200 px-1.5 text-[11px] text-stone-700">{{ group.items.length }}</span>
              </h2>
              <ul class="mt-2 divide-y divide-stone-100">
                @for (it of group.items; track it.activity.id) {
                  <li class="flex items-center gap-3 py-2.5">
                    <app-category-chip [category]="it.classification?.category" />
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm text-stone-800">{{ it.activity.text }}</div>
                      @if (group.key === 'note') { <div class="truncate text-xs text-amber-700">“{{ it.annotation?.note }}”</div> }
                    </div>
                    <span class="shrink-0 text-xs text-stone-400">{{ it.activity.timestamp | shortDate }}</span>
                    <button class="btn-ghost !px-2.5 !py-1 text-xs" (click)="undo(it, group.key)">
                      <span class="material-symbols-outlined text-sm">undo</span>{{ group.undo }}
                    </button>
                  </li>
                } @empty {
                  <li class="py-3 text-sm text-stone-400">{{ group.empty }}</li>
                }
              </ul>
            </section>
          }
        }
      </div>

      <div class="space-y-4">
        <a routerLink="/me" [queryParams]="{ preview: 1 }" class="card flex flex-col items-start gap-2 bg-ink p-5 text-white transition hover:shadow-lg">
          <span class="material-symbols-outlined text-3xl text-amber">visibility</span>
          <div class="text-lg font-semibold">Preview what my manager sees</div>
          <div class="text-sm text-white/70">Open your profile exactly as {{ managerName() }} sees it.</div>
        </a>
        <div class="card p-5">
          <h3 class="font-semibold text-ink">Our principles</h3>
          <ul class="mt-3 space-y-3 text-sm text-stone-600">
            <li class="flex gap-2"><span class="material-symbols-outlined text-base text-amber">toggle_on</span><span><b class="text-stone-800">Opt-in.</b> Only opted-in people and chat spaces are analysed.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-base text-amber">block</span><span><b class="text-stone-800">No ranking, no single score.</b> Compared to level expectations, never to teammates.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-base text-amber">compare</span><span><b class="text-stone-800">Same view.</b> You see exactly what your manager sees, and can hide, annotate or dispute anything.</span></li>
            <li class="flex gap-2"><span class="material-symbols-outlined text-base text-amber">link</span><span><b class="text-stone-800">Evidence for every claim.</b> Generated text cites its sources; uncited claims are dropped.</span></li>
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class PrivacyPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);
  readonly ev = new Loadable<EvidenceItem[]>();
  readonly savingOpt = signal(false);
  readonly optedIn = computed(() => this.session.user()?.opted_in ?? true);
  readonly managerName = computed(() => this.session.person(this.session.user()?.manager_id)?.first_name ?? 'your manager');

  readonly groups = computed(() => {
    const list = this.ev.data() ?? [];
    return [
      { key: 'hidden' as const, icon: 'visibility_off', title: 'Hidden from manager', undo: 'Unhide', empty: 'Nothing hidden.', items: list.filter(e => e.annotation?.hidden) },
      { key: 'note' as const, icon: 'chat_bubble', title: 'Annotated', undo: 'Remove note', empty: 'No notes added.', items: list.filter(e => !!e.annotation?.note) },
      { key: 'disputed' as const, icon: 'flag', title: 'Disputed', undo: 'Withdraw', empty: 'No disputes.', items: list.filter(e => e.annotation?.disputed) },
    ];
  });

  constructor() { this.load(); }
  load() { const me = this.session.userId(); if (me) this.ev.load(this.api.evidence(me)); }

  undo(it: EvidenceItem, key: 'hidden' | 'note' | 'disputed') {
    const body = key === 'hidden' ? { hidden: false } : key === 'note' ? { note: null } : { disputed: false };
    this.api.annotate(it.activity.id, body).subscribe({
      next: (a: Annotation) => this.ev.data.update(l => (l ?? []).map(e => e.activity.id === a.activity_id ? { ...e, annotation: a } : e)),
      error: e => this.toast.error(friendlyError(e)),
    });
  }

  toggleOptIn() {
    const me = this.session.user(); if (!me) return;
    this.savingOpt.set(true);
    this.api.setOptIn(me.id, !me.opted_in).subscribe({
      next: p => {
        this.savingOpt.set(false);
        this.session.people.update(list => list.map(x => x.id === p.id ? p : x));
        this.toast.success(p.opted_in ? 'You are opted in to Unsung' : 'Opted out — your activity is no longer analysed');
      },
      error: e => { this.savingOpt.set(false); this.toast.error(friendlyError(e)); },
    });
  }
}

// Who can unblock me?: route a question to teammates who've solved it before, protecting overloaded helpers.
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { HelperFinderResult, HelperSuggestion, LoadStatus } from '../../core/models';
import { parseLink } from '../../core/util/link';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { CategoryChip } from '../../shared/category';
import { CitationChip } from '../../shared/source';
import { EmptyState, ErrorState, Skeleton } from '../../shared/states';
import { ToastService } from '../../shared/toast';

const LOAD_UI: Record<LoadStatus, { label: string; cls: string; icon: string }> = {
  ok: { label: 'Has capacity', cls: 'bg-emerald-50 text-emerald-800', icon: 'check_circle' },
  busy: { label: 'Busy', cls: 'bg-amber-soft text-ink', icon: 'schedule' },
  overloaded: { label: 'Overloaded', cls: 'bg-rose-50 text-rose-800', icon: 'local_fire_department' },
};

@Component({
  selector: 'app-find-helper-page',
  imports: [FormsModule, RouterLink, Avatar, CategoryChip, CitationChip, Skeleton, ErrorState, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Who can unblock me?</h1>
    <p class="mt-1 text-sm text-stone-500">
      Describe what you're stuck on. We find teammates who've solved it before — and steer you away from the people who are already carrying the team.
    </p>

    <div class="card mt-6 p-5">
      <label for="q" class="text-xs font-semibold uppercase tracking-wide text-stone-500">What are you stuck on?</label>
      <textarea id="q" rows="3" [ngModel]="question()" (ngModelChange)="question.set($event)" (keydown.control.enter)="search()"
        placeholder="e.g. Kafka consumer lag keeps growing, maybe a poison message?"
        class="mt-1 w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-ink focus:outline-none"></textarea>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        @for (ex of examples; track ex) {
          <button class="chip bg-stone-100 text-stone-700 hover:bg-stone-200" (click)="question.set(ex); search()">{{ ex }}</button>
        }
        <button class="btn-amber ml-auto" [disabled]="!question().trim() || result.loading()" (click)="search()">
          <span class="material-symbols-outlined text-base">travel_explore</span>Find who can help
        </button>
      </div>
    </div>

    <div class="mt-6 max-w-4xl">
      @if (result.loading()) { <div class="card p-6"><app-skeleton [rows]="6" /></div> }
      @if (result.error(); as e) { <app-error-state [message]="e" (retry)="search()" /> }
      @if (result.data(); as r) {
        <div class="text-xs text-stone-500">
          {{ r.model === 'gemini' ? 'Gemini expanded your question into' : 'Searching for' }}:
          @for (t of r.terms; track t) { <span class="chip ml-1 bg-stone-100 !px-1.5 text-[11px] text-stone-600">{{ t }}</span> }
          <span class="ml-1">· ranking is plain math, not AI</span>
        </div>

        @for (p of r.protected; track p) {
          <div class="mt-3 flex gap-2 rounded-xl bg-indigo-50/70 px-4 py-3 text-sm text-ink">
            <span class="material-symbols-outlined text-base">shield_person</span><span><b>Burnout protection:</b> {{ p }}</span>
          </div>
        }
        @if (r.bus_factor_warning) {
          <div class="mt-3 flex gap-2 rounded-xl bg-amber-soft/70 px-4 py-3 text-sm text-ink">
            <span class="material-symbols-outlined text-base">warning</span><span><b>Knowledge silo:</b> {{ r.bus_factor_warning }}</span>
          </div>
        }

        <div class="mt-4 space-y-4">
          @for (s of r.suggestions; track s.person.id) {
            <div class="card p-5" [class.border-ink]="s.rank === 1">
              <div class="flex items-start gap-3">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">{{ s.rank }}</div>
                <app-avatar [person]="s.person" [size]="44" />
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-semibold text-stone-900">{{ s.person.name }}</span>
                    <span class="text-xs text-stone-500">{{ s.person.title }}</span>
                    <span class="chip {{ load(s).cls }}"><span class="material-symbols-outlined text-sm">{{ load(s).icon }}</span>{{ load(s).label }} · {{ s.load_ratio }}×</span>
                  </div>
                  <p class="mt-1 text-sm text-stone-700">{{ s.reason }}</p>
                  <div class="mt-2 flex items-center gap-2 text-xs text-stone-500">
                    <span class="w-16">Topic match</span>
                    <div class="h-2 w-40 rounded-full bg-stone-100"><div class="h-full rounded-full bg-ink" [style.width.%]="s.relevance * 100"></div></div>
                    <span>{{ (s.relevance * 100).toFixed(0) }}%</span>
                  </div>
                </div>
              </div>

              <ul class="mt-3 space-y-1.5 pl-10">
                @for (a of s.evidence; track a.id) {
                  <li class="flex items-center gap-2 text-sm">
                    <app-category-chip [category]="a.category" />
                    <a class="truncate text-stone-700 hover:underline" [routerLink]="lp(a.link).path" [queryParams]="lp(a.link).queryParams" [attr.title]="a.text">{{ a.text }}</a>
                    <app-citation-chip [id]="a.id" />
                  </li>
                }
              </ul>

              <div class="mt-4 flex gap-2 pl-10">
                <button class="btn-ghost" (click)="copyAsk(s)"><span class="material-symbols-outlined text-base">content_copy</span>Copy a message to {{ s.person.first_name }}</button>
                <a class="btn-ghost" routerLink="/chat"><span class="material-symbols-outlined text-base">chat</span>Open Chat</a>
              </div>
            </div>
          } @empty {
            <div class="card"><app-empty-state icon="search_off" title="Nobody on the team has solved this before" hint="That's a gap worth raising — once you crack it, write it down so the next person doesn't get stuck." /></div>
          }
        </div>
      }
    </div>
  `,
})
export class FindHelperPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  private toast = inject(ToastService);

  readonly question = signal('');
  readonly result = new Loadable<HelperFinderResult>();
  readonly examples = [
    'Kafka consumer lag keeps growing, maybe a poison message?',
    'My pytest tests are flaky and slow',
    'Idempotency key for payment retries',
  ];

  search() {
    const me = this.session.userId(); const q = this.question().trim(); if (!me || !q) return;
    this.result.load(this.api.findHelper(me, q));
  }

  load(s: HelperSuggestion) { return LOAD_UI[s.load_status]; }
  lp(link: string) { return parseLink(link); }

  copyAsk(s: HelperSuggestion) {
    navigator.clipboard?.writeText(s.ask_message).then(
      () => this.toast.success(`Message to ${s.person.first_name} copied`),
      () => this.toast.error('Could not copy to clipboard'),
    );
  }
}

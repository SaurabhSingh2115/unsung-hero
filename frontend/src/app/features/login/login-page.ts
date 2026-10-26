// Persona picker: choose who you are in the demo, or open the Chat app (the data source).
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Person } from '../../core/models';
import { homeUrl } from '../../core/util/guards';
import { Loadable } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';
import { Logo } from '../../shared/logo';
import { ErrorState, Skeleton } from '../../shared/states';

const HINTS: Record<string, { hint: string; icon: string }> = {
  karan: { hint: 'Manager view', icon: 'hub' },
  priya: { hint: 'The hero', icon: 'star' },
  arjun: { hint: 'Got unblocked a lot', icon: 'lock_open' },
  rahul: { hint: 'Idea credited to someone else', icon: 'visibility' },
  meera: { hint: 'Bridges Design & Eng', icon: 'join' },
  dev: { hint: 'New hire, onboarding', icon: 'school' },
};

@Component({
  selector: 'app-login',
  imports: [Avatar, Logo, RouterLink, Skeleton, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-screen bg-gradient-to-b from-indigo-50/60 to-cream px-6 py-12">
      <div class="mx-auto max-w-5xl">
        <app-logo [size]="40" />
        <h1 class="mt-8 text-4xl font-bold tracking-tight text-ink">Credit the invisible work.</h1>
        <p class="mt-3 max-w-2xl text-lg text-stone-600">
          Unsung finds the glue work — unblocking, reviews, mentoring, onboarding, docs, firefighting — and turns it into
          evidence-backed credit. Pick a persona to explore the demo.
        </p>

        <h2 class="mt-10 text-sm font-semibold uppercase tracking-wider text-stone-500">Choose a persona</h2>
        @if (people.loading() && !session.people().length) { <div class="card mt-3 p-6"><app-skeleton [rows]="5" /></div> }
        @if (people.error() && !session.people().length) { <div class="mt-3"><app-error-state [message]="people.error()!" (retry)="reload()" /></div> }
        <div class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          @for (p of sorted(); track p.id) {
            <button (click)="pick(p)"
              class="card group flex flex-col items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2"
              [class.ring-amber]="p.id === 'priya'" [class.ring-ink]="p.id !== 'priya'">
              <div class="flex w-full items-center gap-3">
                <app-avatar [person]="p" [size]="44" />
                <div class="min-w-0">
                  <div class="truncate font-semibold text-stone-900">{{ p.name }}</div>
                  <div class="truncate text-xs text-stone-500">{{ p.title }} · {{ p.level }}</div>
                </div>
              </div>
              <div class="flex w-full flex-wrap items-center gap-1.5">
                <span class="chip" [class]="p.role === 'manager' ? 'bg-ink text-white' : 'bg-stone-100 text-stone-700'">{{ p.role }}</span>
                <span class="chip bg-stone-50 text-stone-500">{{ p.location === 'remote' ? 'Remote' : 'Office' }} · {{ p.city }}</span>
              </div>
              @if (hint(p.id); as h) {
                <div class="flex items-center gap-1 text-sm font-medium" [class]="p.id === 'priya' ? 'text-amber-700' : 'text-ink-soft'">
                  <span class="material-symbols-outlined text-base">{{ h.icon }}</span>{{ h.hint }}
                </div>
              }
            </button>
          }
        </div>

        <a routerLink="/chat" class="card mt-8 flex items-center gap-5 bg-white p-6 transition hover:shadow-md">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gchat-green/10">
            <span class="material-symbols-outlined text-3xl text-gchat-green">forum</span>
          </div>
          <div class="flex-1">
            <div class="text-lg font-semibold text-stone-900">Open the Chat app ↗</div>
            <p class="text-sm text-stone-600">
              This is where the team talks. Messages in opted-in spaces flow through the ingestion pipeline into Unsung —
              post a "thanks for unblocking me" there and watch the profiles update.
            </p>
          </div>
          <span class="material-symbols-outlined text-stone-400">arrow_forward</span>
        </a>
      </div>
    </div>
  `,
})
export class LoginPage {
  readonly session = inject(SessionService);
  private api = inject(ApiService);
  private router = inject(Router);
  readonly people = new Loadable<Person[]>();

  readonly sorted = computed(() => {
    const order = ['karan', 'priya', 'arjun', 'rahul', 'meera', 'sana', 'dev', 'lin'];
    const list = this.people.data() ?? this.session.people();
    return [...list].sort((a, b) => (order.indexOf(a.id) + 99) % 99 - (order.indexOf(b.id) + 99) % 99);
  });

  constructor() { this.reload(); }

  reload() {
    this.people.load(this.api.people());
  }

  hint(id: string) { return HINTS[id] ?? null; }

  pick(p: Person) {
    if (!this.session.people().length && this.people.data()) this.session.people.set(this.people.data()!);
    this.session.setUser(p.id);
    this.router.navigateByUrl(homeUrl(this.session));
  }
}

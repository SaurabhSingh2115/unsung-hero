// Unsung shell: sidebar with role-aware nav, persona switcher, Gemini status, toasts and the source side panel.
import { ChangeDetectionStrategy, Component, computed, effect, inject, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SessionService } from '../core/auth/session.service';
import { AppStateService } from '../core/util/app-state.service';
import { homeUrl } from '../core/util/guards';
import { Avatar } from '../shared/avatar';
import { Logo } from '../shared/logo';
import { SourcePanel } from '../shared/source';
import { ToastHost } from '../shared/toast';

interface NavItem { label: string; icon: string; link: string; exact?: boolean; badge?: number; }

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Avatar, Logo, SourcePanel, ToastHost],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen">
      <aside class="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-line bg-white/70 px-3 py-5">
        <a routerLink="/" class="px-2"><app-logo /></a>
        <div class="mt-5 px-2 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
          {{ session.isManager() ? 'Manager' : 'Employee' }}
        </div>
        <nav class="mt-2 flex flex-col gap-0.5">
          @for (n of nav(); track n.link) {
            <a [routerLink]="n.link" routerLinkActive="!bg-indigo-50 !text-ink font-semibold" [routerLinkActiveOptions]="{ exact: !!n.exact }"
               class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 transition hover:bg-stone-100">
              <span class="material-symbols-outlined text-[20px]">{{ n.icon }}</span>
              <span class="flex-1">{{ n.label }}</span>
              @if (n.badge) {
                <span class="rounded-full bg-amber px-1.5 text-[11px] font-bold text-ink">{{ n.badge }}</span>
              }
            </a>
          }
        </nav>
        <div class="mt-auto flex flex-col gap-0.5 border-t border-line pt-3">
          <a routerLink="/pipeline" routerLinkActive="!bg-indigo-50 !text-ink font-semibold"
             class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">
            <span class="material-symbols-outlined text-[20px]">account_tree</span>Data pipeline
          </a>
          <a routerLink="/chat" class="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-stone-600 hover:bg-stone-100">
            <span class="material-symbols-outlined text-[20px]">forum</span>Chat ↗
          </a>
          <p class="px-3 pt-2 text-[11px] leading-snug text-stone-400">No rankings. No single score. Every claim links to evidence.</p>
        </div>
      </aside>

      <div class="flex min-w-0 flex-1 flex-col">
        <header class="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-cream/85 px-8 py-3 backdrop-blur">
          <div class="text-sm text-stone-500">{{ teamName() }}</div>
          <div class="ml-auto flex items-center gap-3">
            @if (state.config(); as c) {
              <span class="chip gap-1" [class]="c.gemini_enabled ? 'bg-indigo-50 text-ink ring-1 ring-indigo-200' : 'bg-stone-100 text-stone-600'"
                    [attr.title]="c.gemini_enabled ? 'Classification and drafts use Gemini' : 'No Gemini key: deterministic heuristics are used'">
                <span class="material-symbols-outlined" style="font-size:14px">{{ c.gemini_enabled ? 'auto_awesome' : 'rule' }}</span>
                {{ c.gemini_enabled ? 'Gemini on' : 'Heuristic mode' }}
              </span>
            } @else if (state.configError()) {
              <span class="chip bg-rose-50 text-rose-700">Backend offline</span>
            }
            <a routerLink="/chat" class="btn-ghost !py-1.5 text-xs"><span class="material-symbols-outlined text-base">forum</span>Chat ↗</a>
            <label class="flex items-center gap-2 rounded-xl border border-stone-300 bg-white py-1 pl-1.5 pr-2 text-sm">
              <app-avatar [person]="session.user()" [size]="26" />
              <select class="cursor-pointer bg-transparent pr-1 font-medium text-stone-800 focus:outline-none"
                      [value]="session.userId() ?? ''" (change)="switchTo($any($event.target).value)" aria-label="Switch persona">
                @for (p of session.people(); track p.id) {
                  <option [value]="p.id" [selected]="p.id === session.userId()">{{ p.name }}{{ p.role === 'manager' ? ' (manager)' : '' }}</option>
                }
              </select>
            </label>
            <a routerLink="/login" class="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100" title="All personas">
              <span class="material-symbols-outlined text-[20px]">group</span>
            </a>
          </div>
        </header>
        <main class="mx-auto w-full max-w-[1280px] flex-1 px-8 py-7">
          <router-outlet />
        </main>
      </div>
    </div>
    <app-source-panel />
    <app-toast-host />
  `,
})
export class Shell {
  readonly session = inject(SessionService);
  readonly state = inject(AppStateService);
  private router = inject(Router);

  readonly teamName = computed(() => this.session.isManager() ? `${this.session.user()?.first_name ?? ''}'s team · Payments Platform` : 'Payments Platform');

  readonly nav = computed<NavItem[]>(() => this.session.isManager()
    ? [
        { label: 'Team Graph', icon: 'hub', link: '/manager/team' },
        { label: 'Alerts', icon: 'notifications', link: '/manager/alerts' },
        { label: 'Review drafts', icon: 'description', link: '/manager/review' },
        { label: '1:1 Prep', icon: 'groups', link: '/manager/one-on-one' },
        { label: 'Bias check', icon: 'balance', link: '/manager/bias' },
      ]
    : [
        { label: 'My Profile', icon: 'person', link: '/me', exact: true },
        { label: 'Brag Doc', icon: 'article', link: '/me/brag' },
        { label: 'Promotion Packet', icon: 'rocket_launch', link: '/me/promo' },
        { label: 'Say Thanks', icon: 'volunteer_activism', link: '/me/thanks', badge: this.state.unthankedCount() },
        { label: 'Privacy', icon: 'lock', link: '/me/privacy' },
        { label: 'Log Activity', icon: 'history', link: '/me/log' },
      ]);

  constructor() {
    this.state.loadConfig();
    effect(() => {
      const id = this.session.userId();
      const mgr = this.session.isManager();
      untracked(() => { if (id && !mgr) this.state.refreshUnthanked(); });
    });
  }

  switchTo(id: string) {
    this.session.setUser(id);
    this.router.navigateByUrl(homeUrl(this.session));
  }
}

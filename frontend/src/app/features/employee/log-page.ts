// Log Activity: manually record glue work that tools didn't capture (optionally ask the other person to confirm).
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { Activity, Project } from '../../core/models';
import { Loadable, friendlyError } from '../../core/util/loadable';
import { Avatar } from '../../shared/avatar';

function today(): string { return new Date().toISOString().slice(0, 10); }

@Component({
  selector: 'app-log-page',
  imports: [FormsModule, RouterLink, Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1 class="text-3xl font-bold tracking-tight text-ink">Log activity</h1>
    <p class="mt-1 text-sm text-stone-500">Helped someone in a hallway or a call? Capture it so it counts.</p>

    <div class="mt-6 grid gap-5 lg:grid-cols-[1fr_320px]">
      <form class="card space-y-5 p-6" (ngSubmit)="submit()">
        <div>
          <label class="text-sm font-medium text-stone-800" for="what">What did you do?</label>
          <textarea id="what" name="what" rows="4" [ngModel]="text()" (ngModelChange)="text.set($event)" required
            placeholder="e.g. Paired with Dev for an hour to debug the webhook retry logic and wrote up the fix in the runbook."
            class="mt-1.5 w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-ink focus:outline-none"></textarea>
        </div>
        <div>
          <div class="text-sm font-medium text-stone-800">Who did you help?</div>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (p of others(); track p.id) {
              <button type="button" (click)="toggle(p.id)"
                class="inline-flex items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-sm transition"
                [class]="targets().includes(p.id) ? 'border-ink bg-ink text-white' : 'border-stone-300 bg-white text-stone-700 hover:bg-stone-50'">
                <app-avatar [person]="p" [size]="22" />{{ p.first_name }}
              </button>
            }
          </div>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="text-sm font-medium text-stone-800" for="date">When</label>
            <input id="date" name="date" type="date" [max]="maxDate" [ngModel]="date()" (ngModelChange)="date.set($event)"
              class="mt-1.5 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm focus:border-ink focus:outline-none" />
          </div>
          <div>
            <label class="text-sm font-medium text-stone-800" for="proj">Project <span class="text-stone-400">(optional)</span></label>
            <select id="proj" name="proj" [ngModel]="projectId()" (ngModelChange)="projectId.set($event)"
              class="mt-1.5 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm focus:border-ink focus:outline-none">
              <option [ngValue]="null">None</option>
              @for (pr of projects.data() ?? []; track pr.id) { <option [ngValue]="pr.id">{{ pr.name }}</option> }
            </select>
          </div>
        </div>
        <label class="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="confirm" class="h-4 w-4 accent-ink" [ngModel]="confirm()" (ngModelChange)="confirm.set($event)" />
          Ask them to confirm <span class="text-stone-400">(confirmed entries carry more weight)</span>
        </label>
        @if (error()) { <div class="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{{ error() }}</div> }
        <button type="submit" class="btn-primary" [disabled]="!canSubmit() || saving()">
          <span class="material-symbols-outlined text-base">{{ saving() ? 'progress_activity' : 'add_task' }}</span>Log activity
        </button>
      </form>

      <div class="space-y-4">
        @if (created(); as a) {
          <div class="card border-emerald-200 bg-emerald-50 p-5">
            <div class="flex items-center gap-2 font-semibold text-emerald-800"><span class="material-symbols-outlined">check_circle</span>Logged</div>
            <p class="mt-1 text-sm text-emerald-900">{{ a.text }}</p>
            <div class="mt-3 flex gap-2">
              <a class="btn-ghost !py-1.5 text-xs" [routerLink]="['/source', a.id]">View {{ a.id }}</a>
              <a class="btn-ghost !py-1.5 text-xs" routerLink="/me">My profile</a>
            </div>
          </div>
        }
        <div class="card p-5 text-sm text-stone-600">
          <div class="font-semibold text-ink">Tips</div>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li>Be specific: what was blocked, what changed.</li>
            <li>Logged items are labelled "Logged manually" so everyone knows the source.</li>
            <li>You can hide or annotate them later from your profile.</li>
          </ul>
        </div>
      </div>
    </div>
  `,
})
export class LogPage {
  private api = inject(ApiService);
  private session = inject(SessionService);
  readonly projects = new Loadable<Project[]>();
  readonly text = signal('');
  readonly targets = signal<string[]>([]);
  readonly date = signal(today());
  readonly projectId = signal<string | null>(null);
  readonly confirm = signal(true);
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);
  readonly created = signal<Activity | null>(null);
  readonly maxDate = today();

  readonly others = computed(() => this.session.people().filter(p => p.id !== this.session.userId()));
  readonly canSubmit = computed(() => this.text().trim().length > 3);

  constructor() { this.projects.load(this.api.projects()); }

  toggle(id: string) { this.targets.update(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id]); }

  submit() {
    if (!this.canSubmit()) return;
    this.saving.set(true); this.error.set(null);
    const ts = new Date(`${this.date()}T12:00:00`).toISOString();
    this.api.logActivity({
      text: this.text().trim(), target_ids: this.targets(), timestamp: ts,
      project_id: this.projectId(), request_confirmation: this.confirm(),
    }).subscribe({
      next: a => { this.saving.set(false); this.created.set(a); this.text.set(''); this.targets.set([]); },
      error: e => { this.saving.set(false); this.error.set(friendlyError(e)); },
    });
  }
}

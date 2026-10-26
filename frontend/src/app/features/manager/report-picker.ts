// Picker listing the manager's direct reports (used by Review drafts and 1:1 Prep when no id is chosen).
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { Avatar } from '../../shared/avatar';
import { EmptyState } from '../../shared/states';

@Component({
  selector: 'app-report-picker',
  imports: [RouterLink, Avatar, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      @for (p of reports(); track p.id) {
        <a [routerLink]="[base(), p.id]" class="card flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
          <app-avatar [person]="p" [size]="40" />
          <div class="min-w-0 flex-1">
            <div class="font-semibold text-stone-900">{{ p.name }}</div>
            <div class="truncate text-xs text-stone-500">{{ p.title }} · {{ p.level }}</div>
          </div>
          <span class="material-symbols-outlined text-stone-400">{{ icon() }}</span>
        </a>
      } @empty {
        <div class="card sm:col-span-2 lg:col-span-3"><app-empty-state icon="group" title="No direct reports found" /></div>
      }
    </div>
  `,
})
export class ReportPicker {
  private session = inject(SessionService);
  readonly base = input.required<string>();
  readonly icon = input('arrow_forward');
  readonly reports = computed(() => this.session.people().filter(p => p.manager_id === this.session.userId()));
}

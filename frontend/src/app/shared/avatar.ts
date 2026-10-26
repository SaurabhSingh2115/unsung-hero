// Avatar circle with initials on the person's avatar_color.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SessionService } from '../core/auth/session.service';
import { Person } from '../core/models';

@Component({
  selector: 'app-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none"
          [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * 0.38"
          [style.background]="p()?.avatar_color ?? '#a8a29e'" [attr.title]="p()?.name ?? id()">
      {{ p()?.initials ?? (id() ?? '?').slice(0, 2).toUpperCase() }}
    </span>
  `,
})
export class Avatar {
  private session = inject(SessionService);
  readonly person = input<Person | null | undefined>(null);
  readonly id = input<string | null | undefined>(null);
  readonly size = input(32);
  readonly p = computed(() => this.person() ?? this.session.person(this.id()) ?? null);
}

/** Small "avatar + first name" chip for a person id. */
@Component({
  selector: 'app-person-chip',
  imports: [Avatar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="inline-flex items-center gap-1 rounded-full bg-stone-100 py-0.5 pl-0.5 pr-2 text-xs text-stone-700">
      <app-avatar [id]="id()" [size]="18" />{{ name() }}
    </span>
  `,
})
export class PersonChip {
  private session = inject(SessionService);
  readonly id = input.required<string>();
  readonly name = computed(() => this.session.person(this.id())?.first_name ?? this.id());
}

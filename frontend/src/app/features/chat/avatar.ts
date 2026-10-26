// Round initials avatar for a person id (resolves via SessionService.people).
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'chat-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-flex shrink-0' },
  template: `
    <span
      class="inline-flex items-center justify-center rounded-full font-medium text-white select-none"
      [class.ring-2]="ring()" [class.ring-white]="ring()"
      [style.width.px]="size()" [style.height.px]="size()"
      [style.font-size.px]="size() * 0.4"
      [style.background]="color()"
      [attr.title]="title() ? name() : null"
      [attr.aria-label]="decorative() ? null : name()"
      [attr.aria-hidden]="decorative() ? 'true' : null"
      [attr.role]="decorative() ? null : 'img'">{{ initials() }}</span>
  `,
})
export class ChatAvatar {
  private session = inject(SessionService);
  readonly personId = input<string | null | undefined>(null);
  readonly size = input(32);
  readonly ring = input(false);
  readonly title = input(false);
  readonly decorative = input(true);

  private person = computed(() => this.session.person(this.personId()));
  protected initials = computed(() => this.person()?.initials ?? (this.personId()?.slice(0, 2).toUpperCase() || '?'));
  protected color = computed(() => this.person()?.avatar_color ?? '#9aa0a6');
  protected name = computed(() => this.person()?.name ?? this.personId() ?? 'Unknown');
}

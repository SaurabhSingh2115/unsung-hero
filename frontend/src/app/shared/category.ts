// Category chip, source icon, and shared label/icon maps.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Category, Source } from '../core/models';

export const CATEGORY_LABEL: Record<Category, string> = {
  mentoring: 'Mentoring', unblocking: 'Unblocking', review: 'Review', documentation: 'Documentation',
  onboarding: 'Onboarding', firefighting: 'Firefighting', core: 'Core work',
};

export const ALL_CATEGORIES: Category[] = ['unblocking', 'review', 'mentoring', 'documentation', 'onboarding', 'firefighting', 'core'];

export const SOURCE_ICON: Record<Source, string> = {
  chat: 'forum', code_review: 'code', doc_comment: 'description', ticket: 'bug_report',
  calendar: 'event', manual: 'edit_note', launch_doc: 'rocket_launch', recognition: 'favorite',
};

export const SOURCE_LABEL: Record<Source, string> = {
  chat: 'Chat', code_review: 'Code review', doc_comment: 'Doc comment', ticket: 'Ticket',
  calendar: 'Calendar', manual: 'Logged manually', launch_doc: 'Launch doc', recognition: 'Recognition',
};

export function catColor(c: Category | string | null | undefined): string {
  return c ? `var(--color-cat-${c})` : 'var(--color-cat-core)';
}

@Component({
  selector: 'app-category-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="chip whitespace-nowrap" [style.background]="bg()" [style.color]="'#292524'">
      {{ label() }}
    </span>
  `,
})
export class CategoryChip {
  readonly category = input<Category | null | undefined>(null);
  readonly label = computed(() => { const c = this.category(); return c ? CATEGORY_LABEL[c] ?? c : 'Unclassified'; });
  readonly bg = computed(() => `color-mix(in srgb, ${catColor(this.category())} 55%, white)`);
}

@Component({
  selector: 'app-source-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="material-symbols-outlined text-stone-500" [style.font-size.px]="size()" [attr.title]="label()">{{ icon() }}</span>`,
})
export class SourceIcon {
  readonly source = input.required<Source>();
  readonly size = input(20);
  readonly icon = computed(() => SOURCE_ICON[this.source()] ?? 'description');
  readonly label = computed(() => SOURCE_LABEL[this.source()] ?? this.source());
}

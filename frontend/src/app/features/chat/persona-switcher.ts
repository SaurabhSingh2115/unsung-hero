// Top-right persona switcher for the Chat clone ("Signed in as …"). Uses the chat persona, not the Unsung one.
import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { ChatAvatar } from './avatar';

@Component({
  selector: 'chat-persona-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatAvatar],
  host: { class: 'relative', '(document:keydown.escape)': 'open.set(false)' },
  template: `
    <button type="button"
      class="flex items-center gap-2 rounded-full p-1 pr-1 hover:bg-[#e9eef6] focus-visible:outline-2 focus-visible:outline-gchat-blue cursor-pointer"
      [attr.aria-expanded]="open()" aria-haspopup="menu"
      [attr.aria-label]="'Switch chat persona. Signed in as ' + (me()?.name ?? session.chatUserId())"
      (click)="open.set(!open())">
      <chat-avatar [personId]="session.chatUserId()" [size]="34" />
    </button>

    @if (open()) {
      <button type="button" class="fixed inset-0 z-40 cursor-default" aria-label="Close persona menu" tabindex="-1" (click)="open.set(false)"></button>
      <div role="menu" class="absolute right-0 top-12 z-50 w-80 rounded-3xl bg-[#e9eef6] p-2 shadow-xl">
        <div class="rounded-2xl bg-white p-4 text-center">
          <div class="flex justify-center"><chat-avatar [personId]="session.chatUserId()" [size]="64" /></div>
          <div class="mt-2 text-[15px] font-medium text-[#1f1f1f]">{{ me()?.name ?? session.chatUserId() }}</div>
          <div class="text-xs text-[#444746]">{{ me()?.email }}</div>
          <div class="mt-1 text-xs text-[#444746]">Signed in as <span class="font-medium">{{ me()?.name ?? session.chatUserId() }}</span></div>
        </div>
        <div class="mt-2 px-3 pb-1 text-xs font-medium text-[#444746]">Switch persona (demo)</div>
        <div class="max-h-80 overflow-y-auto rounded-2xl bg-white py-1">
          @for (p of others(); track p.id) {
            <button type="button" role="menuitem"
              class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-[#f2f6fc] focus-visible:bg-[#f2f6fc] focus-visible:outline-none cursor-pointer"
              (click)="choose(p.id)">
              <chat-avatar [personId]="p.id" [size]="30" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm text-[#1f1f1f]">{{ p.name }}</span>
                <span class="block truncate text-xs text-[#444746]">{{ p.title }} · {{ p.team }}</span>
              </span>
            </button>
          } @empty {
            <div class="px-4 py-3 text-sm text-[#444746]">No people loaded.</div>
          }
        </div>
      </div>
    }
  `,
})
export class PersonaSwitcher {
  protected session = inject(SessionService);
  readonly changed = output<string>();
  protected open = signal(false);
  protected me = computed(() => this.session.chatUser());
  protected others = computed(() => this.session.people().filter(p => p.id !== this.session.chatUserId()));

  protected choose(id: string) {
    this.open.set(false);
    if (id === this.session.chatUserId()) return;
    this.session.setChatUser(id);
    this.changed.emit(id);
  }
}

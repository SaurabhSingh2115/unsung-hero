// Left rail: "New chat" button + Spaces / Direct messages lists.
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/auth/session.service';
import { ChatSpace } from '../../core/models';
import { ChatAvatar } from './avatar';
import { formatShort } from './chat-utils';

@Component({
  selector: 'chat-space-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ChatAvatar],
  host: { class: 'flex h-full flex-col min-h-0' },
  template: `
    <div class="px-3 pb-3">
      <button type="button"
        class="flex items-center gap-3 rounded-2xl bg-[#c2e7ff] py-4 pl-4 pr-6 text-sm font-medium text-[#001d35] shadow-sm transition hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gchat-blue cursor-pointer"
        aria-label="Start a new chat" (click)="newChat.emit()">
        <span class="material-symbols-outlined text-[22px]">edit_square</span>
        New chat
      </button>
    </div>

    <nav class="flex-1 overflow-y-auto pb-4 pr-2" aria-label="Conversations">
      @if (loading() && !spaces().length) {
        @for (i of [1,2,3,4,5]; track i) {
          <div class="mx-3 my-2 flex items-center gap-3 animate-pulse">
            <div class="h-8 w-8 rounded-lg bg-[#e1e5ea]"></div>
            <div class="flex-1"><div class="h-3 w-3/4 rounded bg-[#e1e5ea]"></div><div class="mt-1.5 h-2.5 w-1/2 rounded bg-[#e9edf1]"></div></div>
          </div>
        }
      } @else {
        <h2 class="px-6 pb-1 pt-2 text-[13px] font-medium text-[#1f1f1f]">Spaces</h2>
        @for (s of rooms(); track s.id) {
          <a [routerLink]="['/chat', s.id]"
            class="item group" [class.selected]="s.id === selectedId()"
            [attr.aria-current]="s.id === selectedId() ? 'page' : null">
            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-white"
              [style.background]="spaceColor(s.id)" aria-hidden="true">{{ s.name.charAt(0).toUpperCase() }}</span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1">
                <span class="truncate text-sm text-[#1f1f1f]" [class.font-medium]="s.id === selectedId()">{{ s.name }}</span>
                @if (!s.opted_in_to_unsung) {
                  <span class="material-symbols-outlined text-[15px] text-[#747775]" title="Not shared with Unsung" aria-label="Not shared with Unsung">visibility_off</span>
                }
                <span class="ml-auto shrink-0 pl-1 text-[11px] text-[#5f6368]">{{ short(s.last_message_at) }}</span>
              </span>
              @if (s.last_message_preview) {
                <span class="block truncate text-xs text-[#5f6368]">{{ s.last_message_preview }}</span>
              }
            </span>
          </a>
        } @empty {
          <p class="px-6 py-1 text-xs text-[#5f6368]">No spaces yet</p>
        }

        <h2 class="px-6 pb-1 pt-4 text-[13px] font-medium text-[#1f1f1f]">Direct messages</h2>
        @for (s of dms(); track s.id) {
          <a [routerLink]="['/chat', s.id]"
            class="item group" [class.selected]="s.id === selectedId()"
            [attr.aria-current]="s.id === selectedId() ? 'page' : null">
            <chat-avatar [personId]="dmPeer(s)" [size]="32" />
            <span class="min-w-0 flex-1">
              <span class="flex items-center gap-1">
                <span class="truncate text-sm text-[#1f1f1f]" [class.font-medium]="s.id === selectedId()">{{ s.name }}</span>
                @if (!s.opted_in_to_unsung) {
                  <span class="material-symbols-outlined text-[15px] text-[#747775]" title="Not shared with Unsung" aria-label="Not shared with Unsung">visibility_off</span>
                }
                <span class="ml-auto shrink-0 pl-1 text-[11px] text-[#5f6368]">{{ short(s.last_message_at) }}</span>
              </span>
              @if (s.last_message_preview) {
                <span class="block truncate text-xs text-[#5f6368]">{{ s.last_message_preview }}</span>
              }
            </span>
          </a>
        } @empty {
          <p class="px-6 py-1 text-xs text-[#5f6368]">No direct messages yet</p>
        }
      }
    </nav>
  `,
  styles: `
    .item { display: flex; align-items: center; gap: 12px; margin: 1px 0; padding: 6px 12px 6px 24px; border-radius: 0 999px 999px 0; text-decoration: none; outline: none; }
    .item:hover { background: #e9eef6; }
    .item:focus-visible { box-shadow: inset 0 0 0 2px var(--color-gchat-blue); }
    .item.selected { background: var(--color-gchat-selected); }
  `,
})
export class SpaceList {
  private session = inject(SessionService);
  readonly spaces = input.required<ChatSpace[]>();
  readonly selectedId = input<string | null>(null);
  readonly loading = input(false);
  readonly newChat = output<void>();

  protected rooms = computed(() => this.spaces().filter(s => s.kind === 'space'));
  protected dms = computed(() => this.spaces().filter(s => s.kind === 'dm'));
  protected short = formatShort;

  protected dmPeer(s: ChatSpace): string | null {
    const me = this.session.chatUserId();
    return s.member_ids.find(id => id !== me) ?? s.member_ids[0] ?? null;
  }

  private static palette = ['#1a73e8', '#188038', '#e37400', '#a142f4', '#d93025', '#12b5cb', '#c5221f', '#5f6368', '#9334e6', '#0b8043'];
  protected spaceColor(id: string): string {
    let h = 0;
    for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return SpaceList.palette[h % SpaceList.palette.length];
  }
}

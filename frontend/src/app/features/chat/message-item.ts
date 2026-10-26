// A single message: avatar, sender, time, text with mentions, ingestion indicator, and (for roots) a thread footer.
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';
import { ChatMessage } from '../../core/models';
import { ChatAvatar } from './avatar';
import { formatStamp } from './chat-utils';
import { MentionText } from './mention-text';

@Component({
  selector: 'chat-message-item',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatAvatar, MentionText],
  host: {
    class: 'group relative block',
    '[attr.id]': "'msg-' + message().id",
    '[attr.data-msg-id]': 'message().id',
  },
  template: `
    <div class="msg flex gap-3 rounded-xl px-3 py-2" [class.flash]="highlighted()" [class.opacity-60]="pending()">
      <chat-avatar class="mt-0.5" [personId]="message().sender_id" [size]="compact() ? 28 : 32" [title]="true" />
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-2">
          <span class="text-sm font-medium text-[#1f1f1f]">{{ senderName() }}</span>
          <time class="text-xs text-[#5f6368]" [attr.datetime]="message().created_at" [attr.title]="fullDate()">{{ stamp() }}</time>
          @if (message().ingested) {
            <span class="material-symbols-outlined self-center text-[14px] text-[#9aa0a6]" title="Ingested by Unsung" aria-label="Ingested by Unsung">hub</span>
          }
          @if (pending() && !failed()) { <span class="text-xs text-[#5f6368]">Sending…</span> }
        </div>
        <chat-mention-text class="block text-sm leading-5 text-[#1f1f1f]" [text]="message().text" [query]="query()" />

        @if (failed()) {
          <div class="mt-1 flex items-center gap-2 text-xs text-[#b3261e]">
            <span class="material-symbols-outlined text-[16px]">error</span> Not sent.
            <button type="button" class="font-medium underline cursor-pointer" (click)="retry.emit(message())">Retry</button>
            <button type="button" class="text-[#5f6368] underline cursor-pointer" (click)="discard.emit(message())">Discard</button>
          </div>
        }

        @if (isRoot() && showThread()) {
          <div class="mt-1.5 flex items-center gap-2">
            @if (replies().length) {
              <button type="button"
                class="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 text-[13px] font-medium text-gchat-blue hover:bg-[#e8f0fe] focus-visible:outline-2 focus-visible:outline-gchat-blue cursor-pointer"
                [attr.aria-label]="'Open thread, ' + replyLabel()" (click)="openThread.emit(message().id)">
                <span class="flex -space-x-1.5">
                  @for (id of repliers(); track id) { <chat-avatar [personId]="id" [size]="20" [ring]="true" /> }
                </span>
                {{ replyLabel() }}
                <span class="font-normal text-[#5f6368]">· Last reply {{ lastReply() }}</span>
              </button>
            } @else if (!pending()) {
              <button type="button"
                class="reply-btn flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-medium text-[#444746] hover:bg-[#f1f3f4] focus-visible:outline-2 focus-visible:outline-gchat-blue cursor-pointer"
                aria-label="Reply in thread" (click)="openThread.emit(message().id)">
                <span class="material-symbols-outlined text-[18px]">reply</span> Reply
              </button>
            }
          </div>
        }
      </div>
    </div>

    @if (isRoot() && showThread() && !pending()) {
      <div class="toolbar absolute -top-3 right-4 hidden items-center rounded-full border border-[#dadce0] bg-white p-0.5 shadow-sm group-hover:flex group-focus-within:flex">
        <button type="button" class="tb-btn" aria-label="Reply in thread" title="Reply in thread" (click)="openThread.emit(message().id)">
          <span class="material-symbols-outlined text-[18px]">forum</span>
        </button>
      </div>
    }
  `,
  styles: `
    .msg { transition: background-color .15s; }
    :host:hover .msg { background: #f8fafd; }
    .msg.flash { animation: flash 2.6s ease-out 1; }
    @keyframes flash { 0%, 35% { background: #fdeba0; } 100% { background: transparent; } }
    .reply-btn { opacity: .0; }
    :host:hover .reply-btn, .reply-btn:focus-visible { opacity: 1; }
    .tb-btn { display:inline-flex; align-items:center; justify-content:center; width:30px; height:30px; border-radius:999px; color:#444746; cursor:pointer; }
    .tb-btn:hover { background:#f1f3f4; } .tb-btn:focus-visible { outline:2px solid var(--color-gchat-blue); }
  `,
})
export class MessageItem {
  private session = inject(SessionService);
  readonly message = input.required<ChatMessage>();
  readonly replies = input<ChatMessage[]>([]);
  readonly showThread = input(true);
  readonly compact = input(false);
  readonly highlighted = input(false);
  readonly failed = input(false);
  readonly query = input('');
  readonly openThread = output<string>();
  readonly retry = output<ChatMessage>();
  readonly discard = output<ChatMessage>();

  protected isRoot = computed(() => !this.message().thread_id);
  protected pending = computed(() => this.message().id.startsWith('tmp-'));
  protected senderName = computed(() => this.session.person(this.message().sender_id)?.name ?? this.message().sender_id);
  protected stamp = computed(() => formatStamp(this.message().created_at));
  protected fullDate = computed(() => new Date(this.message().created_at).toLocaleString());
  protected replyLabel = computed(() => {
    const n = this.replies().length;
    return `${n} ${n === 1 ? 'reply' : 'replies'}`;
  });
  protected repliers = computed(() => {
    const seen: string[] = [];
    for (const r of this.replies()) if (!seen.includes(r.sender_id)) seen.push(r.sender_id);
    return seen.slice(0, 4);
  });
  protected lastReply = computed(() => {
    const r = this.replies();
    return r.length ? formatStamp(r[r.length - 1].created_at) : '';
  });
}

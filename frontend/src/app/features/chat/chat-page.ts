// "Chat" — a Google-Chat-like clone. Personas talk in spaces/threads here; the backend ingests those
// messages into Unsung. Routes: /chat and /chat/:spaceId (optional ?msg=<id> deep-link highlight).
import {
  ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../../core/api/api.service';
import { SessionService } from '../../core/auth/session.service';
import { ChatMessage, ChatSpace, Person } from '../../core/models';
import { ChatAvatar } from './avatar';
import { byCreated, errorMessage, isUnreachable } from './chat-utils';
import { Composer } from './composer';
import { MessageList } from './message-list';
import { NewChatDialog } from './new-chat-dialog';
import { PersonaSwitcher } from './persona-switcher';
import { SpaceList } from './space-list';
import { ThreadPanel } from './thread-panel';

const MESSAGE_POLL_MS = 2500;

function messagesSignature(list: ChatMessage[]): string {
  return list.map(m => `${m.id}:${m.ingested ? 1 : 0}:${m.reply_count}`).join('|');
}

@Component({
  selector: 'app-chat-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ChatAvatar, SpaceList, MessageList, Composer, ThreadPanel, PersonaSwitcher, NewChatDialog],
  host: { class: 'block h-screen' },
  templateUrl: './chat-page.html',
  styleUrl: './chat-page.css',
})
export class ChatPage {
  private api = inject(ApiService);
  protected session = inject(SessionService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private title = inject(Title);
  private destroyRef = inject(DestroyRef);

  // ---- routing ----
  private params = toSignal(this.route.paramMap);
  private queryParams = toSignal(this.route.queryParamMap);
  protected selectedId = computed(() => this.params()?.get('spaceId') ?? null);
  private msgParam = computed(() => this.queryParams()?.get('msg') ?? null);

  // ---- spaces ----
  protected spaces = signal<ChatSpace[]>([]);
  protected spacesLoaded = signal(false);
  protected spacesError = signal<string | null>(null);
  private fetchedSpace = signal<ChatSpace | null>(null);
  protected space = computed(() => {
    const id = this.selectedId();
    return this.spaces().find(s => s.id === id) ?? (this.fetchedSpace()?.id === id ? this.fetchedSpace() : null);
  });
  protected members = computed<Person[]>(() =>
    (this.space()?.member_ids ?? []).map(id => this.session.person(id)).filter((p): p is Person => !!p));
  protected mentionable = computed(() => this.members().filter(p => p.id !== this.session.chatUserId()));
  protected headerMembers = computed(() => (this.space()?.member_ids ?? []).slice(0, 5));
  protected dmPeer = computed(() => {
    const s = this.space();
    if (!s || s.kind !== 'dm') return null;
    return s.member_ids.find(id => id !== this.session.chatUserId()) ?? s.member_ids[0] ?? null;
  });

  // ---- messages ----
  private serverMessages = signal<ChatMessage[]>([]);
  private messagesFor = signal<string | null>(null);
  protected messagesLoading = signal(false);
  protected messagesError = signal<string | null>(null);
  protected offline = signal(false);
  private pending = signal<ChatMessage[]>([]);
  protected failedIds = signal<Set<string>>(new Set());
  protected messages = computed(() => {
    const id = this.selectedId();
    if (!id || this.messagesFor() !== id) return [];
    return [...this.serverMessages(), ...this.pending().filter(p => p.space_id === id)];
  });

  // ---- UI state ----
  protected search = signal('');
  protected scrollToken = signal(0);
  protected highlightId = signal<string | null>(null);
  protected threadRootId = signal<string | null>(null);
  protected threadRoot = computed(() => this.messages().find(m => m.id === this.threadRootId()) ?? null);
  protected threadReplies = computed(() => {
    const id = this.threadRootId();
    return id ? this.messages().filter(m => m.thread_id === id).sort(byCreated) : [];
  });
  protected showNewChat = signal(false);
  protected dmBusy = signal(false);
  protected dmError = signal<string | null>(null);

  private lastSig = '';
  private msgSub?: Subscription;
  private pollInFlight = false;
  private spacesInFlight = false;
  private handledDeepLink: string | null = null;
  private highlightTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.loadSpaces();

    // Default to the first space when no :spaceId in the URL.
    effect(() => {
      const list = this.spaces();
      if (!this.selectedId() && list.length) {
        untracked(() => this.router.navigate(['/chat', list[0].id], { replaceUrl: true, queryParamsHandling: 'preserve' }));
      }
    });

    // Space switch: reset per-space state and load.
    effect(() => {
      const id = this.selectedId();
      untracked(() => {
        this.threadRootId.set(null);
        this.highlightId.set(null);
        this.search.set('');
        this.messagesError.set(null);
        this.handledDeepLink = null;
        if (id) this.loadMessages(id, true);
      });
    });

    // Deep link: ?msg=<id> → open its thread if it's a reply, scroll + flash.
    effect(() => {
      const msg = this.msgParam();
      const id = this.selectedId();
      const list = this.messages();
      if (!msg || !id || !list.length) return;
      const key = `${id}|${msg}`;
      if (this.handledDeepLink === key) return;
      const target = list.find(m => m.id === msg);
      if (!target) return;
      this.handledDeepLink = key;
      untracked(() => {
        if (target.thread_id) this.threadRootId.set(target.thread_id);
        this.flash(target.id);
      });
    });

    effect(() => {
      const s = this.space();
      this.title.setTitle(s ? `${s.name} – Chat` : 'Chat');
    });

    // Live updates while visible.
    let tick = 0;
    const timer = setInterval(() => {
      if (document.hidden) return;
      tick++;
      this.pollMessages();
      if (tick % 2 === 0) this.loadSpaces();
    }, MESSAGE_POLL_MS);
    const onVisible = () => { if (!document.hidden) { this.pollMessages(); this.loadSpaces(); } };
    document.addEventListener('visibilitychange', onVisible);
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      clearTimeout(this.highlightTimer);
      document.removeEventListener('visibilitychange', onVisible);
      this.msgSub?.unsubscribe();
      this.title.setTitle('Unsung');
    });
  }

  // ---------------- data loading ----------------
  protected loadSpaces(after?: (list: ChatSpace[]) => void) {
    if (this.spacesInFlight && !after) return;
    this.spacesInFlight = true;
    if (!this.session.people().length) {
      this.api.people().subscribe({ next: p => this.session.people.set(p), error: () => {} });
    }
    this.api.chatSpaces().subscribe({
      next: list => {
        this.spacesInFlight = false;
        if (JSON.stringify(list) !== JSON.stringify(this.spaces())) this.spaces.set(list);
        this.spacesLoaded.set(true);
        this.spacesError.set(null);
        this.offline.set(false);
        after?.(list);
      },
      error: err => {
        this.spacesInFlight = false;
        this.spacesLoaded.set(true);
        if (isUnreachable(err)) this.offline.set(true);
        if (!this.spaces().length) this.spacesError.set(errorMessage(err));
      },
    });
  }

  private loadMessages(id: string, initial: boolean) {
    this.msgSub?.unsubscribe();
    if (initial) {
      this.messagesLoading.set(true);
      this.serverMessages.set([]);
      this.messagesFor.set(null);
      this.lastSig = '';
      this.scrollToken.update(t => t + 1);
      if (!this.spaces().some(s => s.id === id)) {
        this.api.chatSpace(id).subscribe({ next: s => this.fetchedSpace.set(s), error: () => {} });
      }
    }
    this.msgSub = this.api.chatMessages(id).subscribe({
      next: list => this.acceptMessages(id, list),
      error: err => {
        if (this.selectedId() !== id) return;
        this.messagesLoading.set(false);
        if (isUnreachable(err)) this.offline.set(true);
        if (this.messagesFor() !== id) this.messagesError.set(errorMessage(err));
      },
    });
  }

  private pollMessages() {
    const id = this.selectedId();
    if (!id || this.pollInFlight || this.messagesLoading() || this.messagesError()) return;
    this.pollInFlight = true;
    this.api.chatMessages(id).subscribe({
      next: list => { this.pollInFlight = false; this.acceptMessages(id, list); },
      error: err => { this.pollInFlight = false; if (isUnreachable(err)) this.offline.set(true); },
    });
  }

  private acceptMessages(id: string, list: ChatMessage[]) {
    if (this.selectedId() !== id) return;
    const sig = messagesSignature(list);
    if (this.messagesFor() !== id || sig !== this.lastSig) {
      this.serverMessages.set(list);
      this.messagesFor.set(id);
      this.lastSig = sig;
    }
    this.messagesLoading.set(false);
    this.messagesError.set(null);
    this.offline.set(false);
  }

  protected retryAll() {
    this.spacesError.set(null);
    this.spacesLoaded.set(false);
    this.loadSpaces();
    const id = this.selectedId();
    if (id) { this.messagesError.set(null); this.loadMessages(id, true); }
  }

  // ---------------- actions ----------------
  protected send(text: string, threadId: string | null = null) {
    const spaceId = this.selectedId();
    if (!spaceId) return;
    const tmp: ChatMessage = {
      id: `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      space_id: spaceId,
      thread_id: threadId,
      sender_id: this.session.chatUserId(),
      text,
      created_at: new Date().toISOString(),
      mentions: [],
      reply_count: 0,
      ingested: false,
    };
    this.pending.update(p => [...p, tmp]);
    if (!threadId) this.scrollToken.update(t => t + 1);
    this.post(tmp);
  }

  private post(tmp: ChatMessage) {
    this.failedIds.update(s => { const n = new Set(s); n.delete(tmp.id); return n; });
    this.api.postChatMessage(tmp.space_id, tmp.text, tmp.thread_id).subscribe({
      next: real => {
        this.pending.update(p => p.filter(m => m.id !== tmp.id));
        if (this.messagesFor() === real.space_id) {
          this.serverMessages.update(list => list.some(m => m.id === real.id) ? list : [...list, real]);
        }
        this.loadSpaces();
      },
      error: () => this.failedIds.update(s => new Set(s).add(tmp.id)),
    });
  }

  protected retry(m: ChatMessage) { this.post(m); }
  protected discard(m: ChatMessage) {
    this.pending.update(p => p.filter(x => x.id !== m.id));
    this.failedIds.update(s => { const n = new Set(s); n.delete(m.id); return n; });
  }

  protected openThread(rootId: string) {
    this.threadRootId.set(rootId);
  }

  protected closeThread() {
    this.threadRootId.set(null);
  }

  private flash(id: string) {
    this.highlightId.set(id);
    clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => this.highlightId.set(null), 4000);
  }

  protected openDm(memberId: string) {
    this.dmBusy.set(true);
    this.dmError.set(null);
    this.api.openDm(memberId).subscribe({
      next: space => {
        this.dmBusy.set(false);
        this.showNewChat.set(false);
        if (!this.spaces().some(s => s.id === space.id)) this.spaces.update(list => [space, ...list]);
        this.router.navigate(['/chat', space.id]);
        this.loadSpaces();
      },
      error: err => { this.dmBusy.set(false); this.dmError.set(errorMessage(err)); },
    });
  }

  protected onPersonaChanged() {
    this.pending.set([]);
    this.failedIds.set(new Set());
    this.threadRootId.set(null);
    this.serverMessages.set([]);
    this.messagesFor.set(null);
    this.spaces.set([]);
    this.spacesLoaded.set(false);
    this.loadSpaces(list => {
      const current = this.selectedId();
      if (current && list.some(s => s.id === current)) this.loadMessages(current, true);
      else if (list.length) this.router.navigate(['/chat', list[0].id]);
      else this.router.navigate(['/chat']);
    });
  }

  protected clearSearch(input: HTMLInputElement) {
    this.search.set('');
    input.value = '';
    input.focus();
  }
}

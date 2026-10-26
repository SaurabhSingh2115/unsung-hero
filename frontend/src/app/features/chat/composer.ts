// Message composer: auto-growing textarea, Enter to send (Shift+Enter newline), @mention autocomplete.
import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { Person } from '../../core/models';
import { ChatAvatar } from './avatar';

interface MentionState { start: number; query: string; }

let nextId = 0;

@Component({
  selector: 'chat-composer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChatAvatar],
  host: { class: 'block relative' },
  template: `
    @if (suggestions().length) {
      <ul [id]="listId" role="listbox" aria-label="Mention suggestions"
        class="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-72 overflow-y-auto rounded-2xl border border-[#dadce0] bg-white py-1.5 shadow-lg">
        @for (p of suggestions(); track p.id; let i = $index) {
          <li role="option" [id]="listId + '-' + i" [attr.aria-selected]="i === active()"
            class="flex cursor-pointer items-center gap-3 px-3 py-1.5"
            [class.opt-active]="i === active()"
            (mousedown)="$event.preventDefault(); choose(p)" (mouseenter)="active.set(i)">
            <chat-avatar [personId]="p.id" [size]="26" />
            <span class="min-w-0">
              <span class="block truncate text-sm text-[#1f1f1f]">{{ p.name }}</span>
              <span class="block truncate text-xs text-[#5f6368]">{{ p.email }}</span>
            </span>
          </li>
        }
      </ul>
    }
    <div class="flex items-end gap-2 rounded-3xl bg-[#f0f4f9] py-1.5 pl-5 pr-1.5 focus-within:bg-white focus-within:shadow-[0_0_0_1px_#c4c7c5,0_1px_3px_rgba(0,0,0,.12)]"
      [class.opacity-60]="disabled()">
      <textarea #ta rows="1"
        class="max-h-40 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-sm leading-5 text-[#1f1f1f] outline-none placeholder:text-[#5f6368]"
        [placeholder]="placeholder()" [attr.aria-label]="placeholder()" [disabled]="disabled()"
        role="combobox" aria-autocomplete="list" [attr.aria-expanded]="suggestions().length > 0"
        [attr.aria-controls]="listId"
        [attr.aria-activedescendant]="suggestions().length ? listId + '-' + active() : null"
        [value]="text()"
        (input)="onInput()" (keydown)="onKeydown($event)" (click)="updateMention()" (blur)="mention.set(null)"></textarea>
      <button type="button"
        class="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-gchat-blue"
        [class.send-on]="canSend()" [class.send-off]="!canSend()"
        [disabled]="!canSend()" aria-label="Send message" title="Send message" (click)="submit()">
        <span class="material-symbols-outlined text-[22px]" style="font-variation-settings: 'FILL' 1">send</span>
      </button>
    </div>
  `,
  styles: `
    .opt-active { background: #e8f0fe; }
    .send-on { color: var(--color-gchat-blue); cursor: pointer; }
    .send-on:hover { background: #e8f0fe; }
    .send-off { color: #9aa0a6; }
  `,
})
export class Composer {
  readonly placeholder = input('Message');
  readonly members = input<Person[]>([]);
  readonly disabled = input(false);
  readonly send = output<string>();

  protected readonly listId = `mention-list-${nextId++}`;
  protected text = signal('');
  protected mention = signal<MentionState | null>(null);
  protected active = signal(0);
  private ta = viewChild.required<ElementRef<HTMLTextAreaElement>>('ta');

  protected canSend = computed(() => !this.disabled() && this.text().trim().length > 0);
  protected suggestions = computed(() => {
    const m = this.mention();
    if (!m) return [];
    const q = m.query.toLowerCase();
    return this.members()
      .filter(p => !q || p.first_name.toLowerCase().startsWith(q) || p.name.toLowerCase().startsWith(q)
        || p.name.toLowerCase().split(' ').some(part => part.startsWith(q)))
      .slice(0, 8);
  });

  focus() { this.ta().nativeElement.focus(); }

  protected onInput() {
    const el = this.ta().nativeElement;
    this.text.set(el.value);
    this.autosize();
    this.updateMention();
  }

  protected updateMention() {
    const el = this.ta().nativeElement;
    const before = el.value.slice(0, el.selectionStart ?? el.value.length);
    const m = /(^|\s)@([A-Za-z]*)$/.exec(before);
    if (m) {
      const start = before.length - m[2].length - 1;
      const prev = this.mention();
      if (!prev || prev.query !== m[2]) this.active.set(0);
      this.mention.set({ start, query: m[2] });
    } else {
      this.mention.set(null);
    }
  }

  protected onKeydown(e: KeyboardEvent) {
    const list = this.suggestions();
    if (list.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); this.active.set((this.active() + 1) % list.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set((this.active() - 1 + list.length) % list.length); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); this.choose(list[this.active()] ?? list[0]); return; }
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.mention.set(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      this.submit();
    }
  }

  protected choose(p: Person) {
    const m = this.mention();
    if (!m) return;
    const el = this.ta().nativeElement;
    const caret = el.selectionStart ?? el.value.length;
    const insert = `@${p.first_name} `;
    const value = el.value.slice(0, m.start) + insert + el.value.slice(caret);
    el.value = value;
    this.text.set(value);
    this.mention.set(null);
    const pos = m.start + insert.length;
    el.focus();
    el.setSelectionRange(pos, pos);
    this.autosize();
  }

  protected submit() {
    const value = this.text().trim();
    if (!value || this.disabled()) return;
    this.send.emit(value);
    this.text.set('');
    this.mention.set(null);
    const el = this.ta().nativeElement;
    el.value = '';
    this.autosize();
    el.focus();
  }

  private autosize() {
    const el = this.ta().nativeElement;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  }
}

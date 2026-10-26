// Renders message text with @FirstName mentions as blue pills and optional search-match highlighting.
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SessionService } from '../../core/auth/session.service';

interface Segment { kind: 'text' | 'mention' | 'match'; text: string; self?: boolean; title?: string; }

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

@Component({
  selector: 'chat-mention-text',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'whitespace-pre-wrap break-words' },
  template: `@for (s of segments(); track $index) {@switch (s.kind) {@case ('mention') {<span class="mention" [class.self]="s.self" [attr.title]="s.title">{{ s.text }}</span>}@case ('match') {<mark class="match">{{ s.text }}</mark>}@default {<span>{{ s.text }}</span>}}}`,
  styles: `
    .mention { color: var(--color-gchat-blue); background: #e8f0fe; border-radius: 4px; padding: 0 3px; font-weight: 500; }
    .mention.self { background: #c2e7ff; color: #041e49; }
    .match { background: #fde293; color: inherit; border-radius: 2px; padding: 0 1px; }
  `,
})
export class MentionText {
  private session = inject(SessionService);
  readonly text = input.required<string>();
  readonly query = input('');

  protected segments = computed<Segment[]>(() => {
    const people = this.session.people();
    const me = this.session.chatUserId();
    const byFirst = new Map(people.map(p => [p.first_name.toLowerCase(), p]));
    const out: Segment[] = [];
    const q = this.query().trim();
    const pushText = (t: string) => {
      if (!t) return;
      if (!q) { out.push({ kind: 'text', text: t }); return; }
      const parts = t.split(new RegExp(`(${escapeRegExp(q)})`, 'gi'));
      parts.forEach((p, i) => p && out.push({ kind: i % 2 ? 'match' : 'text', text: p }));
    };
    const re = /@([A-Za-z][A-Za-z'-]*)/g;
    const text = this.text();
    let last = 0;
    for (let m = re.exec(text); m; m = re.exec(text)) {
      const person = byFirst.get(m[1].toLowerCase());
      if (!person) continue;
      // Ignore emails like foo@bar.
      if (m.index > 0 && /[\w.]/.test(text[m.index - 1])) continue;
      pushText(text.slice(last, m.index));
      out.push({ kind: 'mention', text: '@' + m[1], self: person.id === me, title: person.name });
      last = m.index + m[0].length;
    }
    pushText(text.slice(last));
    return out;
  });
}

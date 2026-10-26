// One evidence item row: category, source, date, text, people, confidence, link, and (self only) hide/annotate/dispute.
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../core/api/api.service';
import { Annotation, EvidenceItem } from '../core/models';
import { parseLink } from '../core/util/link';
import { friendlyError } from '../core/util/loadable';
import { PersonChip } from './avatar';
import { CategoryChip, SourceIcon } from './category';
import { ShortDatePipe } from './pipes';
import { ToastService } from './toast';

@Component({
  selector: 'app-evidence-row',
  imports: [FormsModule, RouterLink, PersonChip, CategoryChip, SourceIcon, ShortDatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let a = item().activity;
    @let ann = item().annotation;
    <div class="group flex gap-3 rounded-xl px-3 py-3 transition hover:bg-stone-50"
         [class.opacity-50]="ann?.hidden">
      <div class="mt-0.5 flex w-8 shrink-0 justify-center"><app-source-icon [source]="a.source" /></div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <app-category-chip [category]="item().classification?.category" />
          <span class="text-xs text-stone-500">{{ a.timestamp | shortDate }}</span>
          @if (a.project_name) { <span class="text-xs text-stone-400">· {{ a.project_name }}</span> }
          @if (item().classification; as c) {
            <span class="relative text-xs text-stone-400 underline decoration-dotted underline-offset-2 cursor-help"
                  (mouseenter)="showWhy.set(true)" (mouseleave)="showWhy.set(false)" tabindex="0"
                  (focus)="showWhy.set(true)" (blur)="showWhy.set(false)">
              {{ (c.confidence * 100).toFixed(0) }}% · {{ c.model === 'gemini' ? 'Gemini' : 'heuristic' }}
              @if (showWhy()) {
                <span class="absolute left-0 top-5 z-20 w-72 rounded-lg bg-ink p-2.5 text-xs leading-snug text-white no-underline shadow-xl">
                  {{ c.rationale }}
                </span>
              }
            </span>
          }
          @if (ann?.hidden) { <span class="chip bg-stone-200 text-stone-700"><span class="material-symbols-outlined mr-0.5" style="font-size:13px">visibility_off</span>Hidden from manager</span> }
          @if (ann?.disputed) { <span class="chip bg-rose-50 text-rose-700"><span class="material-symbols-outlined mr-0.5" style="font-size:13px">flag</span>Disputed</span> }
        </div>
        <p class="mt-1 text-sm leading-relaxed text-stone-800">{{ a.text }}</p>
        <div class="mt-1.5 flex flex-wrap items-center gap-1.5">
          @for (pid of people(); track pid) { <app-person-chip [id]="pid" /> }
          @for (d of item().dimensions; track d) { <span class="text-[11px] text-stone-400">#{{ d }}</span> }
          <a class="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-ink-soft hover:underline"
             [routerLink]="link().path" [queryParams]="link().queryParams">
            {{ link().path.startsWith('/chat') ? 'Open in Chat' : 'View source' }}
            <span class="material-symbols-outlined" style="font-size:14px">arrow_outward</span>
          </a>
        </div>
        @if (ann?.note && !editing()) {
          <div class="mt-2 flex items-start gap-1.5 rounded-lg bg-amber-soft px-2.5 py-1.5 text-xs text-stone-800">
            <span class="material-symbols-outlined text-amber" style="font-size:15px">sticky_note_2</span>
            <span class="flex-1">{{ ann?.note }}</span>
          </div>
        }
        @if (editing()) {
          <div class="mt-2 flex gap-2">
            <input class="flex-1 rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm focus:border-ink focus:outline-none"
                   placeholder="Add context your manager will see…" [(ngModel)]="draftNote" (keydown.enter)="saveNote()" />
            <button class="btn-primary !py-1.5" (click)="saveNote()" [disabled]="busy()">Save</button>
            <button class="btn-ghost !py-1.5" (click)="editing.set(false)">Cancel</button>
          </div>
        }
      </div>
      @if (editable()) {
        <div class="flex shrink-0 items-start gap-0.5 opacity-60 transition group-hover:opacity-100">
          <button class="rounded-lg p-1.5 hover:bg-stone-200" [disabled]="busy()" (click)="toggleHidden()"
                  [attr.title]="ann?.hidden ? 'Show to manager' : 'Hide from manager'">
            <span class="material-symbols-outlined text-[20px]">{{ ann?.hidden ? 'visibility_off' : 'visibility' }}</span>
          </button>
          <button class="rounded-lg p-1.5 hover:bg-stone-200" (click)="startEdit()" title="Annotate">
            <span class="material-symbols-outlined text-[20px]" [class.text-amber]="!!ann?.note">chat_bubble</span>
          </button>
          <button class="rounded-lg p-1.5 hover:bg-stone-200" [disabled]="busy()" (click)="toggleDispute()"
                  [attr.title]="ann?.disputed ? 'Withdraw dispute' : 'Dispute this classification'">
            <span class="material-symbols-outlined text-[20px]" [class.text-rose-600]="!!ann?.disputed">flag</span>
          </button>
        </div>
      }
    </div>
  `,
})
export class EvidenceRow {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  readonly item = input.required<EvidenceItem>();
  /** Person whose profile this is (excluded from the people chips). */
  readonly ownerId = input<string | null>(null);
  readonly editable = input(false);
  readonly annotated = output<Annotation>();

  readonly showWhy = signal(false);
  readonly editing = signal(false);
  readonly busy = signal(false);
  draftNote = '';

  readonly link = computed(() => parseLink(this.item().activity.link));
  readonly people = computed(() => {
    const a = this.item().activity;
    return [a.actor_id, ...a.target_ids].filter((id, i, arr) => id !== this.ownerId() && arr.indexOf(id) === i);
  });

  toggleHidden() { this.save({ hidden: !this.item().annotation?.hidden }); }
  toggleDispute() { this.save({ disputed: !this.item().annotation?.disputed }); }
  startEdit() { this.draftNote = this.item().annotation?.note ?? ''; this.editing.set(true); }
  saveNote() { this.save({ note: this.draftNote.trim() || null }, () => this.editing.set(false)); }

  private save(body: Partial<Pick<Annotation, 'hidden' | 'note' | 'disputed'>>, done?: () => void) {
    this.busy.set(true);
    this.api.annotate(this.item().activity.id, body).subscribe({
      next: a => { this.busy.set(false); this.annotated.emit(a); done?.(); },
      error: e => { this.busy.set(false); this.toast.error(friendlyError(e)); },
    });
  }
}

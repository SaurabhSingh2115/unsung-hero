// Source viewer: /source/:activityId — the original record behind any claim.
import { ChangeDetectionStrategy, Component, effect, inject, input, untracked } from '@angular/core';
import { Location } from '@angular/common';
import { ApiService } from '../../core/api/api.service';
import { SourceRecord } from '../../core/models';
import { Loadable } from '../../core/util/loadable';
import { SourceDetail } from '../../shared/source';
import { ErrorState, Skeleton } from '../../shared/states';

@Component({
  selector: 'app-source-page',
  imports: [SourceDetail, Skeleton, ErrorState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl">
      <div class="flex items-center gap-2">
        <button class="rounded-lg p-1 text-stone-500 hover:bg-stone-100" (click)="back()" aria-label="Back"><span class="material-symbols-outlined">arrow_back</span></button>
        <h1 class="text-2xl font-bold tracking-tight text-ink">Source <span class="font-mono text-lg text-stone-500">{{ activityId() }}</span></h1>
      </div>
      <p class="mt-1 mb-5 text-sm text-stone-500">The original record behind this piece of evidence, and how Unsung classified it.</p>
      @if (rec.loading()) { <div class="card p-6"><app-skeleton [rows]="7" /></div> }
      @if (rec.error(); as e) { <app-error-state [message]="e" (retry)="load()" /> }
      @if (rec.data(); as r) { <app-source-detail [record]="r" /> }
    </div>
  `,
})
export class SourcePage {
  private api = inject(ApiService);
  private location = inject(Location);
  readonly activityId = input.required<string>();
  readonly rec = new Loadable<SourceRecord>();
  constructor() { effect(() => { this.activityId(); untracked(() => this.load()); }); }
  load() { this.rec.load(this.api.activity(this.activityId())); }
  back() { this.location.back(); }
}

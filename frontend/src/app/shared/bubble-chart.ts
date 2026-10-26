// Impact vs Effort bubble chart. x = effort (activities), y = impact (0–100), r ∝ complexity.
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { QuadrantPoint } from '../core/models';

const W = 460, H = 300;
const M = { l: 44, r: 16, t: 14, b: 40 };
const PW = W - M.l - M.r, PH = H - M.t - M.b;

interface Bubble { p: QuadrantPoint; x: number; y: number; r: number; }

@Component({
  selector: 'app-bubble-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="block w-full" role="img" aria-label="Impact versus effort">
        <!-- quadrants -->
        <rect [attr.x]="m.l" [attr.y]="m.t" [attr.width]="pw / 2" [attr.height]="ph / 2" fill="#eef2ff" />
        <rect [attr.x]="m.l + pw / 2" [attr.y]="m.t" [attr.width]="pw / 2" [attr.height]="ph / 2" fill="#fdf3dc" />
        <rect [attr.x]="m.l" [attr.y]="m.t + ph / 2" [attr.width]="pw / 2" [attr.height]="ph / 2" fill="#fafaf9" />
        <rect [attr.x]="m.l + pw / 2" [attr.y]="m.t + ph / 2" [attr.width]="pw / 2" [attr.height]="ph / 2" fill="#f5f5f4" />
        <rect [attr.x]="m.l" [attr.y]="m.t" [attr.width]="pw" [attr.height]="ph" fill="none" stroke="#e7e5e4" rx="4" />
        <text [attr.x]="m.l + 8" [attr.y]="m.t + 16" class="q">Quick wins</text>
        <text [attr.x]="m.l + pw - 8" [attr.y]="m.t + 16" text-anchor="end" class="q">Big bets</text>
        <text [attr.x]="m.l + 8" [attr.y]="m.t + ph - 8" class="q">Low leverage</text>
        <text [attr.x]="m.l + pw - 8" [attr.y]="m.t + ph - 8" text-anchor="end" class="q">Grind</text>
        <!-- axes -->
        <text [attr.x]="m.l + pw / 2" [attr.y]="h - 8" text-anchor="middle" class="ax">Effort (activities) →</text>
        <text [attr.x]="14" [attr.y]="m.t + ph / 2" text-anchor="middle" class="ax" [attr.transform]="'rotate(-90 14 ' + (m.t + ph / 2) + ')'">Impact →</text>
        <text [attr.x]="m.l" [attr.y]="m.t + ph + 14" class="tick">0</text>
        <text [attr.x]="m.l + pw" [attr.y]="m.t + ph + 14" text-anchor="end" class="tick">{{ maxEffort() }}</text>
        <!-- bubbles -->
        @for (b of bubbles(); track b.p.project_id) {
          <g class="cursor-pointer" (mouseenter)="hover.set(b)" (mouseleave)="hover.set(null)" (click)="toggle(b.p)">
            <circle [attr.cx]="b.x" [attr.cy]="b.y" [attr.r]="b.r"
                    [attr.fill]="b.p.role === 'enabler' ? '#f2b544' : '#1e1b4b'"
                    [attr.fill-opacity]="selected() && selected() !== b.p.project_id ? 0.25 : 0.88"
                    [attr.stroke]="selected() === b.p.project_id ? '#f2b544' : '#fff'" stroke-width="2" />
            @if (b.r > 18) {
              <text [attr.x]="b.x" [attr.y]="b.y + 3" text-anchor="middle" font-size="9.5" font-weight="600"
                    [attr.fill]="b.p.role === 'enabler' ? '#1e1b4b' : '#fff'" pointer-events="none">{{ short(b.p.project_name) }}</text>
            }
          </g>
        }
      </svg>
      @if (hover(); as b) {
        <div class="pointer-events-none absolute z-10 w-56 rounded-xl bg-ink p-3 text-xs text-white shadow-xl"
             [style.left.%]="(b.x / w) * 100" [style.top.%]="(b.y / h) * 100" style="transform: translate(-50%, calc(-100% - 14px))">
          <div class="font-semibold">{{ b.p.project_name }}</div>
          <div class="mt-1 grid grid-cols-2 gap-x-2 text-white/80">
            <span>Impact</span><span class="text-right text-white">{{ b.p.impact }}/100</span>
            <span>Effort</span><span class="text-right text-white">{{ b.p.effort }} activities</span>
            <span>Complexity</span><span class="text-right text-white">{{ b.p.complexity }}/5</span>
            <span>Role</span><span class="text-right capitalize text-amber">{{ b.p.role }}</span>
          </div>
        </div>
      }
    </div>
    <div class="mt-1 flex flex-wrap items-center gap-3 text-xs text-stone-500">
      <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-ink"></span>Owner / contributor</span>
      <span class="inline-flex items-center gap-1"><span class="h-2.5 w-2.5 rounded-full bg-amber"></span>Enabler</span>
      <span class="ml-auto italic">Effort is always shown with complexity · bubble size = complexity</span>
    </div>
  `,
  styles: [`
    .q { font-size: 11px; font-weight: 600; fill: #78716c; }
    .ax { font-size: 11px; fill: #57534e; }
    .tick { font-size: 10px; fill: #a8a29e; }
  `],
})
export class BubbleChart {
  readonly points = input.required<QuadrantPoint[]>();
  readonly selected = input<string | null>(null);
  readonly picked = output<QuadrantPoint | null>();
  readonly hover = signal<Bubble | null>(null);

  readonly w = W; readonly h = H; readonly m = M; readonly pw = PW; readonly ph = PH;

  readonly maxEffort = computed(() => {
    const max = Math.max(1, ...this.points().map(p => p.effort));
    return Math.ceil(max * 1.15);
  });

  readonly bubbles = computed<Bubble[]>(() => {
    const maxE = this.maxEffort();
    return [...this.points()]
      .sort((a, b) => b.complexity - a.complexity)
      .map(p => {
        const r = 8 + (Math.max(1, Math.min(5, p.complexity)) - 1) * 6;
        const x = M.l + Math.max(r, Math.min(PW - r, (p.effort / maxE) * PW));
        const y = M.t + Math.max(r, Math.min(PH - r, (1 - p.impact / 100) * PH));
        return { p, x, y, r };
      });
  });

  short(name: string): string { return name.length > 12 ? name.slice(0, 11) + '…' : name; }
  toggle(p: QuadrantPoint) { this.picked.emit(this.selected() === p.project_id ? null : p); }
}

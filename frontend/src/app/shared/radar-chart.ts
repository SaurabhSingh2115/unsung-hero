// Radar chart (6 dimensions, 0–100). No overall score by design. Click an axis to filter evidence.
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { Dimension, RadarDim } from '../core/models';

const SIZE = 340;
const C = SIZE / 2;
const R = 110;

@Component({
  selector: 'app-radar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + size + ' ' + size" class="mx-auto block w-full max-w-[360px]" role="img" aria-label="Contribution radar">
      @for (ring of rings; track ring) {
        <polygon [attr.points]="ringPoints(ring)" fill="none" stroke="#e7e5e4" stroke-width="1" />
      }
      @for (ax of axes(); track ax.dim.dimension) {
        <line [attr.x1]="c" [attr.y1]="c" [attr.x2]="ax.x" [attr.y2]="ax.y" stroke="#e7e5e4" />
      }
      <polygon [attr.points]="shape()" fill="rgba(242,181,68,0.35)" stroke="#1e1b4b" stroke-width="2" stroke-linejoin="round" />
      @for (ax of axes(); track ax.dim.dimension) {
        <circle [attr.cx]="ax.px" [attr.cy]="ax.py" r="4" fill="#1e1b4b" />
        <g class="cursor-pointer" (click)="toggle(ax.dim.dimension)" (mouseenter)="hover.set(ax.dim)" (mouseleave)="hover.set(null)">
          <rect [attr.x]="ax.lx - 48" [attr.y]="ax.ly - 13" width="96" height="26" rx="13"
                [attr.fill]="selected() === ax.dim.dimension ? '#1e1b4b' : (hover()?.dimension === ax.dim.dimension ? '#fdf3dc' : 'transparent')" />
          <text [attr.x]="ax.lx" [attr.y]="ax.ly + 4" text-anchor="middle" font-size="12.5" font-weight="500"
                [attr.fill]="selected() === ax.dim.dimension ? '#fff' : '#292524'">{{ ax.dim.dimension }}</text>
        </g>
      }
    </svg>
    <div class="mt-1 min-h-[3.5rem] rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600">
      @if (hover() ?? selectedDim(); as d) {
        <span class="font-semibold text-ink">{{ d.dimension }} · {{ d.score }}/100</span>
        <span class="text-stone-400"> · {{ d.evidence_count }} evidence items</span>
        <div class="mt-0.5">{{ d.explanation }}</div>
      } @else {
        Hover an axis for how it was computed; click to filter the evidence below. Scores compare against level expectations — there is no overall score.
      }
    </div>
  `,
})
export class RadarChart {
  readonly dims = input.required<RadarDim[]>();
  readonly selected = input<Dimension | null>(null);
  readonly picked = output<Dimension | null>();
  readonly hover = signal<RadarDim | null>(null);

  readonly size = SIZE;
  readonly c = C;
  readonly rings = [0.25, 0.5, 0.75, 1];

  readonly selectedDim = computed(() => this.dims().find(d => d.dimension === this.selected()) ?? null);

  private angle(i: number, n: number) { return -Math.PI / 2 + (2 * Math.PI * i) / n; }

  readonly axes = computed(() => {
    const ds = this.dims(); const n = ds.length || 1;
    return ds.map((dim, i) => {
      const a = this.angle(i, n);
      const v = Math.max(0, Math.min(100, dim.score)) / 100;
      return {
        dim,
        x: C + R * Math.cos(a), y: C + R * Math.sin(a),
        px: C + R * v * Math.cos(a), py: C + R * v * Math.sin(a),
        lx: C + (R + 32) * Math.cos(a), ly: C + (R + 26) * Math.sin(a),
      };
    });
  });

  readonly shape = computed(() => this.axes().map(a => `${a.px},${a.py}`).join(' '));

  ringPoints(f: number): string {
    const n = this.dims().length || 6;
    return Array.from({ length: n }, (_, i) => {
      const a = this.angle(i, n);
      return `${C + R * f * Math.cos(a)},${C + R * f * Math.sin(a)}`;
    }).join(' ');
  }

  toggle(d: Dimension) { this.picked.emit(this.selected() === d ? null : d); }
}

// Force-directed help graph (d3-force for layout, SVG rendered by Angular). helper → helped arrows.
import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import {
  Simulation, SimulationLinkDatum, SimulationNodeDatum,
  forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation,
} from 'd3-force';
import { GraphNode, TeamGraph } from '../../core/models';

interface SimNode extends SimulationNodeDatum { id: string; d: GraphNode; r: number; }
interface SimLink extends SimulationLinkDatum<SimNode> { weight: number; }

const W = 720, H = 520;

/** green (≤0) → amber (0.25) → red (≥0.5). */
export function gapColor(gap: number): string {
  const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const green = [34, 160, 90], amber = [242, 181, 68], red = [214, 69, 65];
  const g = Math.max(0, Math.min(0.5, gap));
  const rgb = g <= 0.25 ? lerp(green, amber, g / 0.25) : lerp(amber, red, (g - 0.25) / 0.25);
  return `rgb(${rgb.join(',')})`;
}

@Component({
  selector: 'app-team-graph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      <svg #svg [attr.viewBox]="'0 0 ' + w + ' ' + h" class="block w-full touch-none select-none"
           (pointermove)="onMove($event)" (pointerup)="onUp($event)" (pointerleave)="onUp($event, true)" role="img" aria-label="Team help graph">
        <defs>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#a5a3c4" />
          </marker>
          <marker id="arrow-hi" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="#1e1b4b" />
          </marker>
          <radialGradient id="halo">
            <stop offset="55%" stop-color="#f2b544" stop-opacity="0.65" />
            <stop offset="100%" stop-color="#f2b544" stop-opacity="0" />
          </radialGradient>
        </defs>
        <g [attr.data-tick]="tick()">
        @for (l of links(); track $index) {
          @let s = src(l); @let t = tgt(l); @let hi = isHi(s.id, t.id);
          <path [attr.d]="linkPath(s, t)" fill="none"
                [attr.stroke]="hi ? '#1e1b4b' : '#c7c5df'" [attr.stroke-opacity]="dim(s.id, t.id) ? 0.15 : 0.9"
                [attr.stroke-width]="1 + l.weight * widthScale()" [attr.marker-end]="hi ? 'url(#arrow-hi)' : 'url(#arrow)'" />
        }
        @for (n of nodes(); track n.id) {
          <g [attr.transform]="'translate(' + n.x + ',' + n.y + ')'" class="cursor-pointer"
             [attr.opacity]="hoverId() && !neighbors().has(n.id) ? 0.35 : 1"
             (pointerdown)="onDown($event, n)" (mouseenter)="hoverId.set(n.id)" (mouseleave)="hoverId.set(null)">
            @if (n.id === heroId()) {
              <circle [attr.r]="n.r + 22" fill="url(#halo)" class="halo" />
              <circle [attr.r]="n.r + 4" fill="none" stroke="#f2b544" stroke-width="3" />
            }
            <circle [attr.r]="n.r" [attr.fill]="color(n.d)" stroke="#fff" stroke-width="2.5" />
            <text text-anchor="middle" dy="4" font-size="12" font-weight="600" fill="#fff" pointer-events="none">{{ first(n.d.name) }}</text>
            <text text-anchor="middle" [attr.dy]="n.r + 15" font-size="10.5" fill="#57534e" pointer-events="none">{{ n.d.title }}</text>
          </g>
        }
        </g>
      </svg>
      @if (hoverNode(); as n) {
        <div class="pointer-events-none absolute z-10 w-60 rounded-xl bg-ink p-3 text-xs text-white shadow-xl"
             [style.left.%]="((n.x ?? 0) / w) * 100" [style.top.%]="((n.y ?? 0) / h) * 100"
             style="transform: translate(-50%, calc(-100% - 36px))">
          <div class="text-sm font-semibold">{{ n.d.name }}</div>
          <div class="text-white/60">{{ n.d.title }} · {{ n.d.location }}</div>
          <div class="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5">
            <span class="text-white/70">Help given</span><span class="text-right">{{ n.d.help_given }}</span>
            <span class="text-white/70">Thanks received</span><span class="text-right">{{ n.d.thanks_received }}</span>
            <span class="text-white/70">Unacknowledged</span><span class="text-right font-semibold text-amber">{{ (n.d.unacknowledged_pct * 100).toFixed(0) }}%</span>
            <span class="text-white/70">Bridge score</span><span class="text-right">{{ n.d.bridge_score.toFixed(2) }}</span>
            <span class="text-white/70">Glue work</span><span class="text-right">{{ n.d.glue_work }} ({{ (n.d.glue_share * 100).toFixed(0) }}%)</span>
          </div>
          <div class="mt-2 text-white/50">Click to open profile · drag to move</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .halo { animation: pulse 2.4s ease-in-out infinite; transform-origin: center; }
    @keyframes pulse { 0%,100% { opacity: .75 } 50% { opacity: 1 } }
  `],
})
export class TeamGraphChart implements OnDestroy {
  private router = inject(Router);
  readonly graph = input.required<TeamGraph>();
  private svgRef = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  readonly w = W; readonly h = H;
  readonly nodes = signal<SimNode[]>([]);
  readonly links = signal<SimLink[]>([]);
  readonly tick = signal(0);
  readonly hoverId = signal<string | null>(null);
  private sim?: Simulation<SimNode, SimLink>;
  private drag?: { node: SimNode; sx: number; sy: number; moved: boolean };

  readonly widthScale = computed(() => 5 / Math.max(1, ...this.links().map(l => l.weight)));
  readonly heroId = computed(() => {
    let best: GraphNode | null = null; let score = 0;
    for (const n of this.graph().nodes) {
      const s = n.unacknowledged_pct * n.help_given;
      if (s > score) { score = s; best = n; }
    }
    return best?.id ?? null;
  });
  readonly hoverNode = computed(() => { this.tick(); return this.drag ? null : this.nodes().find(n => n.id === this.hoverId()) ?? null; });
  readonly neighbors = computed(() => {
    const id = this.hoverId(); const set = new Set<string>();
    if (!id) return set;
    set.add(id);
    for (const l of this.links()) {
      const s = this.src(l).id, t = this.tgt(l).id;
      if (s === id) set.add(t); if (t === id) set.add(s);
    }
    return set;
  });

  constructor() {
    effect(() => { const g = this.graph(); untracked(() => this.build(g)); });
  }

  private build(g: TeamGraph) {
    this.sim?.stop();
    const maxGlue = Math.max(1, ...g.nodes.map(n => n.glue_work));
    const nodes: SimNode[] = g.nodes.map((d, i) => ({
      id: d.id, d, r: 16 + 22 * Math.sqrt(d.glue_work / maxGlue),
      x: W / 2 + 160 * Math.cos((2 * Math.PI * i) / g.nodes.length),
      y: H / 2 + 160 * Math.sin((2 * Math.PI * i) / g.nodes.length),
    }));
    const ids = new Set(nodes.map(n => n.id));
    const links: SimLink[] = g.links
      .filter(l => ids.has(l.source) && ids.has(l.target))
      .map(l => ({ source: l.source, target: l.target, weight: l.weight }));
    const maxW = Math.max(1, ...links.map(l => l.weight));

    this.sim = forceSimulation<SimNode, SimLink>(nodes)
      .force('link', forceLink<SimNode, SimLink>(links).id(n => n.id).distance(l => 190 - 70 * (l.weight / maxW)).strength(0.35))
      .force('charge', forceManyBody<SimNode>().strength(-700))
      .force('center', forceCenter(W / 2, H / 2))
      .force('collide', forceCollide<SimNode>().radius(n => n.r + 22))
      .stop();
    for (let i = 0; i < 300; i++) this.sim.tick();
    this.clampAll(nodes);
    this.sim.on('tick', () => { this.clampAll(nodes); this.tick.update(t => t + 1); });

    this.nodes.set(nodes);
    this.links.set(links);
    this.tick.update(t => t + 1);
  }

  private clampAll(nodes: SimNode[]) {
    for (const n of nodes) {
      n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x ?? 0));
      n.y = Math.max(n.r + 4, Math.min(H - n.r - 20, n.y ?? 0));
    }
  }

  src(l: SimLink): SimNode { return l.source as SimNode; }
  tgt(l: SimLink): SimNode { return l.target as SimNode; }
  isHi(s: string, t: string) { const h = this.hoverId(); return !!h && (s === h || t === h); }
  dim(s: string, t: string) { const h = this.hoverId(); return !!h && s !== h && t !== h; }
  color(d: GraphNode) { return gapColor(d.recognition_gap); }
  first(name: string) { return name.split(' ')[0]; }

  /** Slightly curved path that ends at the target's edge (so arrows are visible); curves keep a↔b distinct. */
  linkPath(s: SimNode, t: SimNode): string {
    const sx = s.x ?? 0, sy = s.y ?? 0, tx = t.x ?? 0, ty = t.y ?? 0;
    const dx = tx - sx, dy = ty - sy; const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist, uy = dy / dist;
    const x1 = sx + ux * s.r, y1 = sy + uy * s.r;
    const x2 = tx - ux * (t.r + 3), y2 = ty - uy * (t.r + 3);
    const mx = (x1 + x2) / 2 - uy * dist * 0.12, my = (y1 + y2) / 2 + ux * dist * 0.12;
    return `M${x1},${y1} Q${mx},${my} ${x2},${y2}`;
  }

  private toSvg(e: PointerEvent): { x: number; y: number } {
    const svg = this.svgRef().nativeElement;
    const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    const p = m ? pt.matrixTransform(m.inverse()) : pt;
    return { x: p.x, y: p.y };
  }

  onDown(e: PointerEvent, n: SimNode) {
    e.preventDefault();
    this.svgRef().nativeElement.setPointerCapture?.(e.pointerId);
    this.drag = { node: n, sx: e.clientX, sy: e.clientY, moved: false };
    n.fx = n.x; n.fy = n.y;
  }

  onMove(e: PointerEvent) {
    const d = this.drag; if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return;
    if (!d.moved) { d.moved = true; this.sim?.alphaTarget(0.25).restart(); }
    const p = this.toSvg(e);
    d.node.fx = Math.max(d.node.r, Math.min(W - d.node.r, p.x));
    d.node.fy = Math.max(d.node.r, Math.min(H - d.node.r, p.y));
  }

  onUp(_e: PointerEvent, cancel = false) {
    const d = this.drag; if (!d) return;
    this.drag = undefined;
    d.node.fx = null; d.node.fy = null;
    this.sim?.alphaTarget(0);
    if (!d.moved && !cancel) this.router.navigate(['/person', d.node.id]);
  }

  ngOnDestroy() { this.sim?.stop(); }
}

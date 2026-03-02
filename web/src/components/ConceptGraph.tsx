import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { WorldEntity, WorldRelation } from '@voxtral-flow/shared';

interface Props {
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  degree: number;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  type: string;
}

// Neon palette: blue → cyan → green → amber → coral by degree
const PALETTE = ['#4c6ef5', '#22b8cf', '#51cf66', '#fcc419', '#ff922b', '#ff6b6b'];
function nodeColor(deg: number) { return PALETTE[Math.min(deg, PALETTE.length - 1)]; }
function nodeRadius(deg: number) { return 12 + Math.min(deg, 4) * 4; }

// Dynamic link colors — hash any relation type into a vibrant palette
const LINK_PALETTE = ['#22b8cf', '#ff922b', '#4c6ef5', '#51cf66', '#fcc419', '#cc5de8', '#ff6b6b', '#20c997', '#f06595', '#7950f2', '#94d82d', '#fd7e14'];
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function linkColor(type: string): string { return LINK_PALETTE[hashStr(type) % LINK_PALETTE.length]; }

export function ConceptGraph({ entities, relations }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);

  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of relations) {
      m.set(r.from, (m.get(r.from) || 0) + 1);
      m.set(r.to, (m.get(r.to) || 0) + 1);
    }
    return m;
  }, [relations]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 500;
    const height = svgRef.current.clientHeight || 400;
    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Only show entities that participate in at least one relation (filter orphans)
    const connectedIds = new Set<string>();
    for (const r of relations) { connectedIds.add(r.from); connectedIds.add(r.to); }

    const nodes: NodeDatum[] = Array.from(entities.values())
      .filter(e => connectedIds.has(e.id))
      .map(e => ({
        id: e.id,
        label: e.label,
        degree: degreeMap.get(e.id) || 0,
      }));
    const nodeIds = new Set(nodes.map(n => n.id));
    const links: LinkDatum[] = relations
      .filter(r => nodeIds.has(r.from) && nodeIds.has(r.to))
      .map(r => ({ source: r.from, target: r.to, type: r.type }));

    if (nodes.length === 0) {
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', width / 2).attr('y', height / 2)
        .attr('text-anchor', 'middle').attr('fill', '#444')
        .attr('font-size', '13').attr('font-family', 'ui-monospace, monospace')
        .text('Waiting for entities\u2026');
      return;
    }

    svg.selectAll('*').remove();

    // ── Defs: glow filters + arrow marker + grid ──
    const defs = svg.append('defs');

    // ── Main drawing group (must exist before grid insert) ──
    const g = svg.append('g');

    // Subtle dot grid pattern
    const gridPat = defs.append('pattern').attr('id', 'dot-grid')
      .attr('width', 24).attr('height', 24).attr('patternUnits', 'userSpaceOnUse');
    gridPat.append('circle').attr('cx', 12).attr('cy', 12).attr('r', 0.5).attr('fill', '#2a2a4a');
    g.insert('rect', ':first-child')
      .attr('width', width * 3).attr('height', height * 3)
      .attr('x', -width).attr('y', -height)
      .attr('fill', 'url(#dot-grid)').attr('opacity', 0.7);

    const mkGlow = (id: string, std: number) => {
      const f = defs.append('filter').attr('id', id)
        .attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      f.append('feGaussianBlur').attr('stdDeviation', std).attr('result', 'blur');
      const merge = f.append('feMerge');
      merge.append('feMergeNode').attr('in', 'blur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');
    };
    mkGlow('glow', 3.5);
    mkGlow('link-glow', 2);

    // One arrow marker per link color
    const usedTypes = new Set(links.map(l => l.type));
    for (const type of usedTypes) {
      defs.append('marker').attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10').attr('refX', 22).attr('refY', 0)
        .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
        .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', linkColor(type)).attr('opacity', 0.8);
    }

    // ── Zoom / pan ──

    // Radial vignette
    const radGrad = defs.append('radialGradient').attr('id', 'vignette')
      .attr('cx', '50%').attr('cy', '50%').attr('r', '50%');
    radGrad.append('stop').attr('offset', '0%').attr('stop-color', 'transparent');
    radGrad.append('stop').attr('offset', '85%').attr('stop-color', '#050510').attr('stop-opacity', 0.6);
    svg.insert('rect', ':first-child')
      .attr('width', width).attr('height', height)
      .attr('fill', 'url(#vignette)').attr('pointer-events', 'none');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);

    // ── Links (curved arcs with colored flowing dashes) ──
    const link = g.selectAll<SVGPathElement, LinkDatum>('.link')
      .data(links).join('path').attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => linkColor(d.type))
      .attr('stroke-width', 2).attr('stroke-opacity', 0.5)
      .attr('stroke-dasharray', '6 4')
      .attr('filter', 'url(#link-glow)')
      .attr('marker-end', d => `url(#arrow-${d.type})`);

    // Animate flowing dashes
    function animateLinks() {
      link.attr('stroke-dashoffset', 0)
        .transition().duration(1500).ease(d3.easeLinear)
        .attr('stroke-dashoffset', -20)
        .on('end', animateLinks);
    }
    animateLinks();

    const linkLabel = g.selectAll<SVGTextElement, LinkDatum>('.link-label')
      .data(links).join('text').attr('class', 'link-label')
      .attr('fill', d => linkColor(d.type)).attr('fill-opacity', 0.65)
      .attr('font-size', '8').attr('font-weight', '500')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('text-anchor', 'middle').attr('dy', -5)
      .text(d => d.type);

    // ── Nodes ──
    const node = g.selectAll<SVGGElement, NodeDatum>('.node')
      .data(nodes, d => d.id).join('g').attr('class', 'node')
      .style('cursor', 'grab')
      .call(d3.drag<SVGGElement, NodeDatum>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }))
      .on('mouseenter', function(ev, d) {
        d3.select(this).select('circle:nth-child(2)').transition().duration(200)
          .attr('r', nodeRadius(d.degree) + 4).attr('fill-opacity', 1);
        // Highlight connected links
        link.transition().duration(200)
          .attr('stroke-opacity', l => (l.source as NodeDatum).id === d.id || (l.target as NodeDatum).id === d.id ? 0.9 : 0.15);
        linkLabel.transition().duration(200)
          .attr('fill-opacity', l => (l.source as NodeDatum).id === d.id || (l.target as NodeDatum).id === d.id ? 1 : 0.1);
      })
      .on('mouseleave', function(ev, d) {
        d3.select(this).select('circle:nth-child(2)').transition().duration(300)
          .attr('r', nodeRadius(d.degree)).attr('fill-opacity', 0.9);
        link.transition().duration(300).attr('stroke-opacity', 0.5);
        linkLabel.transition().duration(300).attr('fill-opacity', 0.65);
      });

    // Outer glow halo (pulses on hubs)
    node.append('circle')
      .attr('class', d => d.degree >= 3 ? 'hub-pulse' : '')
      .attr('r', d => nodeRadius(d.degree) + 8)
      .attr('fill', d => nodeColor(d.degree)).attr('opacity', 0.15)
      .attr('filter', 'url(#glow)');

    // Main body
    node.append('circle')
      .attr('r', d => nodeRadius(d.degree))
      .attr('fill', d => nodeColor(d.degree))
      .attr('fill-opacity', 0.9)
      .attr('stroke', d => nodeColor(d.degree))
      .attr('stroke-width', 2.5).attr('stroke-opacity', 0.4)
      .attr('filter', 'url(#glow)');

    // Specular highlight
    node.append('circle')
      .attr('r', d => nodeRadius(d.degree) * 0.35)
      .attr('fill', '#fff').attr('opacity', 0.18)
      .attr('cy', d => -nodeRadius(d.degree) * 0.2);

    // Label with background pill
    node.each(function(d) {
      const g = d3.select(this);
      const fontSize = d.degree >= 3 ? 13 : d.degree >= 1 ? 11 : 9;
      const text = g.append('text')
        .attr('dy', -(nodeRadius(d.degree) + 10))
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', fontSize)
        .attr('font-weight', '700')
        .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
        .attr('filter', 'url(#glow)')
        .attr('paint-order', 'stroke')
        .attr('stroke', '#0a0a1a').attr('stroke-width', 3)
        .text(d.label);
    });

    // Entrance animation: scale up + fade (radial wave from center)
    node.attr('opacity', 0).attr('transform', d => `translate(${width/2},${height/2}) scale(0.01)`)
      .transition().duration(700).delay((_, i) => i * 80)
      .attr('opacity', 1).attr('transform', d => `translate(${d.x ?? width/2},${d.y ?? height/2}) scale(1)`);
    link.attr('stroke-opacity', 0).transition().duration(500).delay((_, i) => i * 60 + 200).attr('stroke-opacity', 0.5);
    linkLabel.attr('fill-opacity', 0).transition().duration(500).delay((_, i) => i * 60 + 200).attr('fill-opacity', 0.65);

    // ── Force simulation ──
    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(130))
      .force('charge', d3.forceManyBody<NodeDatum>().strength(d => -200 - d.degree * 40))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<NodeDatum>().radius(d => nodeRadius(d.degree) + 28))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03));

    function arcPath(d: LinkDatum) {
      const s = d.source as NodeDatum, t = d.target as NodeDatum;
      const dx = t.x! - s.x!, dy = t.y! - s.y!;
      const dr = Math.sqrt(dx * dx + dy * dy) * 0.7;
      return `M${s.x},${s.y}A${dr},${dr} 0 0,1 ${t.x},${t.y}`;
    }

    sim.on('tick', () => {
      link.attr('d', arcPath);
      linkLabel
        .attr('x', d => ((d.source as NodeDatum).x! + (d.target as NodeDatum).x!) / 2)
        .attr('y', d => ((d.source as NodeDatum).y! + (d.target as NodeDatum).y!) / 2);
      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    simRef.current = sim;

    // Auto-fit after stabilization
    sim.on('end', () => {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      nodes.forEach(n => { if (n.x! < x0) x0 = n.x!; if (n.y! < y0) y0 = n.y!; if (n.x! > x1) x1 = n.x!; if (n.y! > y1) y1 = n.y!; });
      const pad = 60, bw = x1 - x0 + pad * 2, bh = y1 - y0 + pad * 2;
      const scale = Math.min(width / bw, height / bh, 1.4);
      const tx = width / 2 - (x0 + x1) / 2 * scale;
      const ty = height / 2 - (y0 + y1) / 2 * scale;
      svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    });

    return () => { sim.stop(); };
  }, [entities, relations, degreeMap]);

  // Render a small legend of active link types
  const activeTypes = [...new Set(relations.map(r => r.type))];

  return (
    <div className="relative w-full h-full" style={{ minHeight: 200 }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: 'radial-gradient(ellipse at center, #0d0d20 0%, #050510 100%)' }}
      />
      {activeTypes.length > 0 && (
        <div className="absolute bottom-2 left-2 flex flex-wrap gap-x-3 gap-y-1 px-2 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm">
          {activeTypes.map(type => (
            <span key={type} className="flex items-center gap-1 text-[9px] font-mono" style={{ color: linkColor(type) }}>
              <span className="inline-block w-3 h-0.5 rounded" style={{ background: linkColor(type) }} />
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

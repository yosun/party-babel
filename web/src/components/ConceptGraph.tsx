import { useEffect, useRef, useMemo } from 'react';
import * as d3 from 'd3';
import type { WorldEntity, WorldRelation } from '@party-babel/shared';

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
function nodeRadius(deg: number) { return 10 + Math.min(deg, 4) * 3; }

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

    const nodes: NodeDatum[] = Array.from(entities.values()).map(e => ({
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

    // ── Defs: glow filters + arrow marker ──
    const defs = svg.append('defs');

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

    defs.append('marker').attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10').attr('refX', 20).attr('refY', 0)
      .attr('markerWidth', 5).attr('markerHeight', 5).attr('orient', 'auto')
      .append('path').attr('d', 'M0,-4L10,0L0,4').attr('fill', '#556').attr('opacity', 0.7);

    // ── Zoom / pan ──
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);

    // ── Links (curved arcs) ──
    const link = g.selectAll<SVGPathElement, LinkDatum>('.link')
      .data(links).join('path').attr('class', 'link')
      .attr('fill', 'none').attr('stroke', '#445')
      .attr('stroke-width', 1.5).attr('stroke-opacity', 0.6)
      .attr('filter', 'url(#link-glow)')
      .attr('marker-end', 'url(#arrow)');

    const linkLabel = g.selectAll<SVGTextElement, LinkDatum>('.link-label')
      .data(links).join('text').attr('class', 'link-label')
      .attr('fill', '#667').attr('font-size', '8')
      .attr('font-family', 'ui-monospace, monospace')
      .attr('text-anchor', 'middle').attr('dy', -4)
      .text(d => d.type);

    // ── Nodes ──
    const node = g.selectAll<SVGGElement, NodeDatum>('.node')
      .data(nodes, d => d.id).join('g').attr('class', 'node')
      .style('cursor', 'grab')
      .call(d3.drag<SVGGElement, NodeDatum>()
        .on('start', (ev, d) => { if (!ev.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (ev, d) => { d.fx = ev.x; d.fy = ev.y; })
        .on('end', (ev, d) => { if (!ev.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    // Outer glow halo
    node.append('circle')
      .attr('r', d => nodeRadius(d.degree) + 6)
      .attr('fill', d => nodeColor(d.degree)).attr('opacity', 0.12)
      .attr('filter', 'url(#glow)');

    // Main body
    node.append('circle')
      .attr('r', d => nodeRadius(d.degree))
      .attr('fill', d => nodeColor(d.degree))
      .attr('fill-opacity', 0.85)
      .attr('stroke', d => nodeColor(d.degree))
      .attr('stroke-width', 2).attr('stroke-opacity', 0.35)
      .attr('filter', 'url(#glow)');

    // Specular highlight
    node.append('circle')
      .attr('r', d => nodeRadius(d.degree) * 0.35)
      .attr('fill', '#fff').attr('opacity', 0.18)
      .attr('cy', d => -nodeRadius(d.degree) * 0.2);

    // Label
    node.append('text')
      .attr('dy', d => -(nodeRadius(d.degree) + 8))
      .attr('text-anchor', 'middle')
      .attr('fill', d => nodeColor(d.degree))
      .attr('font-size', d => d.degree >= 3 ? '12' : '10')
      .attr('font-weight', '600')
      .attr('font-family', 'ui-sans-serif, system-ui, sans-serif')
      .attr('filter', 'url(#glow)')
      .text(d => d.label);

    // Entrance animation
    node.attr('opacity', 0).transition().duration(600).delay((_, i) => i * 40).attr('opacity', 1);
    link.attr('stroke-opacity', 0).transition().duration(400).delay((_, i) => i * 30 + 200).attr('stroke-opacity', 0.6);

    // ── Force simulation ──
    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(110))
      .force('charge', d3.forceManyBody<NodeDatum>().strength(d => -180 - d.degree * 35))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide<NodeDatum>().radius(d => nodeRadius(d.degree) + 22))
      .force('x', d3.forceX(width / 2).strength(0.04))
      .force('y', d3.forceY(height / 2).strength(0.04));

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

  return (
    <svg
      ref={svgRef}
      className="w-full h-full"
      style={{ minHeight: 200, background: 'radial-gradient(ellipse at center, #0d0d20 0%, #050510 100%)' }}
    />
  );
}

import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { WorldEntity, WorldRelation } from '@party-babel/shared';

interface Props {
  entities: Map<string, WorldEntity>;
  relations: WorldRelation[];
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  label: string;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  type: string;
}

export function ConceptGraph({ entities, relations }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<NodeDatum, LinkDatum> | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 400;
    const height = svgRef.current.clientHeight || 300;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    // Build nodes and links
    const nodes: NodeDatum[] = Array.from(entities.values()).map(e => ({
      id: e.id,
      label: e.label,
    }));

    const nodeIds = new Set(nodes.map(n => n.id));
    const links: LinkDatum[] = relations
      .filter(r => nodeIds.has(r.from) && nodeIds.has(r.to))
      .map(r => ({
        source: r.from,
        target: r.to,
        type: r.type,
      }));

    // If empty, show placeholder
    if (nodes.length === 0) {
      svg.selectAll('*').remove();
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '14')
        .text('Entities will appear here...');
      return;
    }

    // Clear and rebuild
    svg.selectAll('*').remove();

    // Arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#666');

    const g = svg.append('g');

    // Links
    const link = g.selectAll<SVGLineElement, LinkDatum>('line')
      .data(links)
      .join('line')
      .attr('stroke', '#555')
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrowhead)');

    // Link labels
    const linkLabel = g.selectAll<SVGTextElement, LinkDatum>('.link-label')
      .data(links)
      .join('text')
      .attr('class', 'link-label')
      .attr('fill', '#888')
      .attr('font-size', '9')
      .attr('text-anchor', 'middle')
      .text(d => d.type);

    // Nodes
    const node = g.selectAll<SVGGElement, NodeDatum>('.node')
      .data(nodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .call(d3.drag<SVGGElement, NodeDatum>()
        .on('start', (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }));

    node.append('circle')
      .attr('r', 12)
      .attr('fill', '#4c6ef5')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5);

    node.append('text')
      .attr('dy', -18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ddd')
      .attr('font-size', '11')
      .attr('font-weight', '600')
      .text(d => d.label);

    // Simulation
    const sim = d3.forceSimulation<NodeDatum>(nodes)
      .force('link', d3.forceLink<NodeDatum, LinkDatum>(links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(25));

    sim.on('tick', () => {
      link
        .attr('x1', d => (d.source as NodeDatum).x!)
        .attr('y1', d => (d.source as NodeDatum).y!)
        .attr('x2', d => (d.target as NodeDatum).x!)
        .attr('y2', d => (d.target as NodeDatum).y!);

      linkLabel
        .attr('x', d => ((d.source as NodeDatum).x! + (d.target as NodeDatum).x!) / 2)
        .attr('y', d => ((d.source as NodeDatum).y! + (d.target as NodeDatum).y!) / 2);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    simRef.current = sim;

    return () => { sim.stop(); };
  }, [entities, relations]);

  return (
    <svg
      ref={svgRef}
      className="w-full h-full bg-gray-950"
      style={{ minHeight: 200 }}
    />
  );
}

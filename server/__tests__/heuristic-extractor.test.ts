import { describe, it, expect } from 'vitest';
import {
  extractEntities,
  extractRelations,
  extractTasks,
  detectDiagramType,
} from '../src/semantics/heuristic-extractor.js';

describe('HeuristicExtractor', () => {
  describe('extractEntities', () => {
    it('extracts capitalized words as entities', () => {
      const entities = extractEntities('Alice talked to Bob about React', 'u1');
      const labels = entities.map(e => e.label);
      expect(labels).toContain('Alice');
      expect(labels).toContain('Bob');
      expect(labels).toContain('REACT');
    });

    it('extracts tech keywords (case-insensitive)', () => {
      const entities = extractEntities('We use redis and postgres for the server', 'u1');
      const ids = entities.map(e => e.id);
      expect(ids).toContain('redis');
      expect(ids).toContain('postgres');
      expect(ids).toContain('server');
    });

    it('skips stop words', () => {
      const entities = extractEntities('The quick brown fox', 'u1');
      const ids = entities.map(e => e.id);
      expect(ids).not.toContain('the');
    });

    it('deduplicates by lowercase id', () => {
      const entities = extractEntities('Server server SERVER', 'u1');
      expect(entities).toHaveLength(1);
    });

    it('sets firstSeenUtteranceId', () => {
      const entities = extractEntities('Alice uses Docker', 'utt-99');
      expect(entities[0].firstSeenUtteranceId).toBe('utt-99');
    });
  });

  describe('extractRelations', () => {
    it('extracts "uses" relation', () => {
      const rels = extractRelations('Server uses Redis for caching', 'u1');
      expect(rels).toHaveLength(1);
      expect(rels[0].from).toBe('server');
      expect(rels[0].to).toBe('redis');
      expect(rels[0].type).toBe('uses');
    });

    it('extracts "depends on" relation', () => {
      const rels = extractRelations('Client depends on API', 'u1');
      expect(rels.length).toBeGreaterThanOrEqual(1);
      expect(rels.some(r => r.type === 'depends_on')).toBe(true);
    });

    it('extracts "connects to" with arrow syntax', () => {
      const rels = extractRelations('Client -> Server', 'u1');
      expect(rels.some(r => r.type === 'connects_to')).toBe(true);
    });

    it('deduplicates relations', () => {
      const rels = extractRelations('Server uses Redis. Server uses Redis again.', 'u1');
      const unique = rels.filter(r => r.from === 'server' && r.to === 'redis');
      expect(unique).toHaveLength(1);
    });
  });

  describe('extractTasks', () => {
    it('extracts "we should" as Now task', () => {
      const tasks = extractTasks("We should deploy the STT pipeline", 'u1');
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks[0].bucket).toBe('Now');
    });

    it('extracts "next" as Next task', () => {
      const tasks = extractTasks("Next we need to add translation", 'u1');
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.some(t => t.bucket === 'Next')).toBe(true);
    });

    it('extracts "later" as Later task', () => {
      const tasks = extractTasks("Later we can add offline diarization", 'u1');
      expect(tasks.length).toBeGreaterThanOrEqual(1);
      expect(tasks.some(t => t.bucket === 'Later')).toBe(true);
    });

    it('sets sourceUtteranceId', () => {
      const tasks = extractTasks("Todo: fix the bug", 'utt-55');
      expect(tasks[0]?.sourceUtteranceId).toBe('utt-55');
    });
  });

  describe('detectDiagramType', () => {
    it('detects architecture keywords', () => {
      expect(detectDiagramType('server client api endpoint pipeline')).toBe('architecture');
    });

    it('detects journey keywords', () => {
      expect(detectDiagramType('user screen flow onboarding step page navigate')).toBe('journey');
    });

    it('detects timeline keywords', () => {
      expect(detectDiagramType('today tomorrow first then after schedule timeline')).toBe('timeline');
    });

    it('detects decision tree keywords', () => {
      expect(detectDiagramType('if else either option should we decide choice')).toBe('decision_tree');
    });

    it('defaults to architecture', () => {
      expect(detectDiagramType('hello world random text')).toBe('architecture');
    });
  });
});

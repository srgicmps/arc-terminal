import { describe, expect, it } from 'vitest';
import type { GdacsEvent, ImpData, NewsItem, TradeDoc } from '../../../types.ts';
import { dossier, fileName, toJson, toMarkdown } from './dossier.ts';
import { hit, seed, settle } from './force.ts';
import { edgesAmong, ego, expand, neighbors, overview, pathTo, searchNodes, targetOf, whyText } from './graph.ts';
import { KINDS, buildGraph, edgeKey, entityIdsIn, leaderPlace, type Kind } from './model.ts';

const item = (title: string, url = title, time = '2026-10-15T08:00:00Z'): NewsItem => ({ title, url, source: 'Medio', time, summary: '' });

const news = [
	item('Trump amenaza a China con nuevos aranceles', 'u1', '2026-10-15T09:00:00Z'),
	item('China responde a Trump y apunta a NVIDIA', 'u2', '2026-10-15T10:00:00Z'),
	item('Lagarde (BCE) avisa sobre la inflación en Alemania', 'u3'),
	item('Repetido: Trump y China', 'u1'),
	item('Japón sube tipos', 'u4')
];

const sanctions: TradeDoc[] = [
	{ id: 's1', title: 'Sanctions on entities in Iran and Russia', type: '', subtype: '', abstract: '', agencies: [], date: '2026-10-14', url: 'https://x/s1', pdf: '', agency: 'OFAC', topic: 'Sanciones' },
	{ id: 's2', title: 'Notice of OFAC Sanctions Actions', type: '', subtype: '', abstract: '', agencies: [], date: '2026-10-14', url: 'https://x/s2', pdf: '', agency: 'OFAC', topic: 'Sanciones' }
];

const events: GdacsEvent[] = [
	{ id: 'EQ1', type: 'EQ', kind: 'Terremoto', level: 'red', name: 'Terremoto en Japón', country: 'Japan', from: '2026-10-13T00:00:00Z', to: null, updated: null, severity: 'M 7', score: 2, lat: 36, lon: 140, url: 'https://x/eq' } as GdacsEvent
];

const imp: ImpData = {
	date: '2026-10-15',
	current: [{ k: 'k1', title: 'Trump y Xi hablan de aranceles con China', url: 'https://x/i1', sources: ['A', 'B', 'C'], score: 80, sections: ['geo'], first: '', time: '2026-10-15T07:00:00Z' }],
	days: [],
	seen: []
};

const g = buildGraph({ news, sanctions, events, imp });
const ALL = KINDS.map((k) => k.value) as Kind[];

describe('grafo de entidades', () => {
	it('reconoce entidades en un titular', () => {
		expect(entityIdsIn('Trump habla con China de NVIDIA')).toEqual(expect.arrayContaining(['leader:trump', 'country:CN', 'ticker:NVDA']));
		expect(entityIdsIn('La meta de déficit')).not.toContain('ticker:META');
	});

	it('pone a cada líder en su país o banco', () => {
		expect(leaderPlace('Presidente · Estados Unidos')).toBe('country:US');
		expect(leaderPlace('Presidenta · Banco Central Europeo')).toBe('bank:ecb');
		expect(leaderPlace('Presidenta · Comisión Europea')).toBeNull();
	});

	it('suma co-menciones sin repetir titulares', () => {
		const e = g.edges.get(edgeKey('leader:trump', 'country:CN'))!;
		expect(e.why.co).toBe(2);
		expect(g.nodes.get('leader:trump')!.mentions).toBe(2);
		expect(g.edges.get(edgeKey('leader:trump', 'country:US'))?.why.cargo).toBe(1);
		expect(g.edges.get(edgeKey('ticker:NVDA', 'country:US'))?.why.pais).toBe(1);
	});

	it('enlaza sanciones, sucesos y temas de IMP', () => {
		expect(g.nodes.has('sanction:s1')).toBe(true);
		expect(g.nodes.has('sanction:s2')).toBe(false);
		expect(neighbors(g, 'sanction:s1').map((n) => n.node.id)).toEqual(expect.arrayContaining(['country:IR', 'country:RU', 'country:US']));
		expect(g.adj.get('event:EQ1')?.has('country:JP')).toBe(true);
		expect(g.nodes.get('event:EQ1')?.at).toEqual([36, 140]);
		expect(g.adj.get('story:k1')?.has('country:CN')).toBe(true);
		expect(g.refs.get('country:JP')!.map((r) => r.kind)).toEqual(expect.arrayContaining(['news', 'event']));
	});

	it('vista inicial, ego y expandir', () => {
		const v = overview(g, ALL, 10);
		expect(v.has('country:CN')).toBe(true);
		expect(v.has('ticker:AAPL')).toBe(false);
		const onlyCountries = overview(g, ['country']);
		expect([...onlyCountries].every((id) => id.startsWith('country:'))).toBe(true);
		const e = ego(g, 'country:CN', ALL, 3);
		expect(e.size).toBe(4);
		const x = expand(g, new Set(['country:US']), 'country:US', ['ticker'], 5);
		expect(x.size).toBe(6);
		expect(edgesAmong(g, x).length).toBeGreaterThanOrEqual(5);
		expect(whyText(g.edges.get(edgeKey('leader:trump', 'country:CN'))!)).toBe('en los mismos titulares (2)');
	});

	it('busca por nombre, código y alias', () => {
		expect(searchNodes(g, 'japon')[0].id).toBe('country:JP');
		expect(searchNodes(g, 'nvda')[0].id).toBe('ticker:NVDA');
		expect(searchNodes(g, 'zara')[0].id).toBe('ticker:ITX');
		expect(searchNodes(g, '')).toEqual([]);
	});

	it('lee y escribe el destino en el path de la ventana', () => {
		expect(targetOf('/expediente#country:ES')).toBe('country:ES');
		expect(targetOf(pathTo('expediente', 'sanction:ofsi:/a b'))).toBe('sanction:ofsi:/a b');
		expect(targetOf('/expediente')).toBeNull();
		expect(targetOf('/expediente#nada:ES')).toBeNull();
		expect(pathTo('grafo', null)).toBe('/grafo');
	});
});

describe('expediente', () => {
	it('junta resumen, datos, cronología y relaciones', () => {
		const d = dossier(g, 'country:CN', { today: '2026-10-15' })!;
		expect(d.label).toBe('China');
		expect(d.summary).toContain('2 titulares');
		expect(d.timeline[0].time! >= d.timeline.at(-1)!.time!).toBe(true);
		expect(d.related.slice(0, 2).map((r) => r.id)).toEqual(['story:k1', 'leader:trump']);
		expect(d.links[0].href).toBe('/pais?c=CN');
		expect(d.at).toEqual([35.9, 104.2]);
		expect(dossier(g, 'country:XX')).toBeNull();
		const bank = dossier(g, 'bank:ecb', { today: '2026-10-15' })!;
		expect(bank.facts.find((f) => f.label === 'Próxima reunión')?.value).toBe('2026-10-29');
		expect(bank.facts.find((f) => f.label === 'Preside')?.value).toBe('Christine Lagarde');
	});

	it('exporta a Markdown y JSON', () => {
		const d = dossier(g, 'country:JP')!;
		const md = toMarkdown(d, '2026-10-15', 'https://arc');
		expect(md).toMatch(/^# Japón/);
		expect(md).toContain('## Cronología');
		expect(md).toContain('[Ficha en PAIS](https://arc/pais?c=JP)');
		expect(JSON.parse(toJson(d, 'hoy')).label).toBe('Japón');
		expect(fileName(d, 'md')).toBe('expediente-japon.md');
	});
});

describe('fuerzas', () => {
	it('acerca lo enlazado y separa lo demás, sin NaN', () => {
		const b = seed(['a', 'b', 'c', 'd']);
		settle(b, [{ a: 0, b: 1, w: 5 }], 300);
		const d = (i: number, j: number) => Math.hypot(b[i].x - b[j].x, b[i].y - b[j].y);
		expect(b.every((x) => Number.isFinite(x.x) && Number.isFinite(x.y))).toBe(true);
		expect(d(0, 1)).toBeLessThan(d(2, 3));
		expect(hit(b, b[2].x + 1, b[2].y)?.id).toBe('c');
		expect(hit(b, 1e6, 1e6)).toBeNull();
	});
});

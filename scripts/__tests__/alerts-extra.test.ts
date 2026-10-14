// Reglas de avisos de la rama claude/ntfy-extra: conflictos, elecciones, IA, lanzamientos, ajedrez, SEMANA
// y valores seguidos. Las muestras tienen la forma real de cada JSON (ver los tipos citados en cada bloque).
import { describe, expect, it } from 'vitest';
import {
	aiRule,
	conflictRule,
	electionName,
	electionRule,
	emptyLog,
	impRule,
	madrid,
	namesCountry,
	type Inputs,
	type NotifyLog,
	type Rule,
	type RuleContext
} from '../alerts/rules.ts';

// 14 oct 2026, 12:00 en Madrid (CEST).
const NOW = Date.parse('2026-10-14T10:00:00Z');
const HOUR = 3_600_000;

function run(rule: Rule['run'], d: Inputs, log: NotifyLog = emptyLog(), now = NOW) {
	const updates: ((l: NotifyLog) => void)[] = [];
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: (fn) => void updates.push(fn) };
	const alerts = rule(d, ctx);
	const after = structuredClone(log);
	for (const fn of updates) fn(after);
	return { alerts, ids: alerts.map((a) => a.id), after };
}

const withLast = (last: Record<string, string>): NotifyLog => ({ ...emptyLog(), last });

/** Un tema de IMP (current[]) con la forma de ImpCurrent de src/lib/types.ts. */
const topic = (k: string, title: string, media: number, sections: string[] = ['geo']) => ({
	k,
	title,
	url: `https://example.org/${k}`,
	sources: Array.from({ length: media }, (_, i) => `Medio ${i}`),
	sections,
	score: 20,
	first: '2026-10-14T06:00:00.000Z',
	time: '2026-10-14T09:30:00.000Z'
});

describe('Conflictos', () => {
	it('P1 si cumple IMP_BIG, P2 con 5 medios o más; texto con medios, secciones y enlace', () => {
		const d: Inputs = {
			imp: {
				current: [
					topic('a', 'Rusia lanza una ofensiva con misiles sobre Kiev', 11, ['geo', 'eco', 'ws']),
					topic('b', 'Israel y Hamás acuerdan un alto el fuego', 5),
					topic('c', 'Ceasefire talks stall', 4),
					topic('d', 'El BCE baja los tipos', 12, ['eco', 'ws', 'es'])
				]
			}
		};
		const { alerts } = run(conflictRule, d);
		expect(alerts.map((a) => [a.id, a.level])).toEqual([
			['conflict:a:2026-10-14T10:00Z', 1],
			['conflict:b:2026-10-14T10:00Z', 2]
		]);
		expect(alerts[0].title).toBe('⚠ Escalada');
		expect(alerts[0].body).toBe(
			'Rusia lanza una ofensiva con misiles sobre Kiev · 11 medios · GEO/ECO/WS\nhttps://example.org/a'
		);
		expect(alerts[0].click).toBe('https://example.org/a');
		// El aviso IMP genérico no repite el tema del conflicto (sí el del BCE).
		expect(run(impRule, d).ids).toEqual(['imp:d']);
	});

	it('12 h de espera por tema, salvo que pase de P2 a P1', () => {
		const p2 = { imp: { current: [topic('b', 'Tregua en Gaza', 6)] } };
		const first = run(conflictRule, p2);
		const log = emptyLog();
		first.alerts[0].commit!(log);
		expect(run(conflictRule, p2, log, NOW + 11 * HOUR).ids).toEqual([]);
		expect(run(conflictRule, p2, log, NOW + 12 * HOUR).ids).toHaveLength(1);
		const p1 = { imp: { current: [topic('b', 'Tregua en Gaza', 9, ['geo', 'es', 'eco'])] } };
		const up = run(conflictRule, p1, log, NOW + HOUR);
		expect(up.alerts.map((a) => a.level)).toEqual([1]);
		up.alerts[0].commit!(log);
		expect(run(conflictRule, p1, log, NOW + 2 * HOUR).ids).toEqual([]);
	});
});

describe('Elecciones', () => {
	// Forma de elections.json (rama claude/elecciones): Election de src/lib/types.ts.
	const de = {
		date: '2026-10-14',
		country: 'Alemania',
		iso: 'DE',
		kind: 'general',
		name: 'Elecciones federales de Alemania de 2026',
		url: 'https://www.wikidata.org/wiki/Q1'
	};
	const minor = { ...de, country: 'Bolivia', iso: 'BO', name: 'Elecciones generales de Bolivia de 2026' };

	it('«Hoy vota» desde las 8:00 de Madrid, solo del G20 y la UE', () => {
		const d: Inputs = { elections: { items: [de, minor] } };
		expect(run(electionRule, d, emptyLog(), Date.parse('2026-10-14T05:59:00Z')).ids).toEqual([]);
		const { alerts, after } = run(electionRule, d);
		expect(alerts.map((a) => a.id)).toEqual(['vote:DE:2026-10-14']);
		expect(alerts[0].title).toBe('🗳 Hoy vota Alemania: elecciones federales');
		// Se apunta la votación para reconocer el resultado mañana.
		expect(after.last['vote:DE']).toBe('2026-10-14');
		expect(after.last['vote:BO']).toBeUndefined();
	});

	it('resultado: tema de IMP del día o del siguiente con el país, «gana» o «election» y 5 medios', () => {
		const log = withLast({ 'vote:DE': '2026-10-13' });
		const imp = (title: string, media: number): Inputs => ({ imp: { current: [topic('x', title, media)] } });
		// Ayer votó Alemania: hoy ya no sale en elections.json, pero está apuntada.
		expect(run(electionRule, imp('La CDU gana las elecciones en Alemania', 4), log).ids).toEqual([]);
		const es = run(electionRule, imp('La CDU gana las elecciones en Alemania', 5), log);
		expect(es.ids).toEqual(['vote-result:DE:2026-10-13']);
		expect(es.alerts[0].title).toBe('🗳 Resultados en Alemania');
		expect(es.alerts[0].body).toBe('La CDU gana las elecciones en Alemania · 5 medios\nhttps://example.org/x');
		expect(run(electionRule, imp('Merz wins Germany election', 6), log).ids).toEqual(['vote-result:DE:2026-10-13']);
		expect(run(electionRule, imp('Alemania debate el presupuesto', 9), log).ids).toEqual([]);
		// Hace más de un día: se olvida.
		const old = run(electionRule, imp('La CDU gana en Alemania', 9), withLast({ 'vote:DE': '2026-10-12' }));
		expect(old.ids).toEqual([]);
		expect(old.after.last['vote:DE']).toBeUndefined();
	});

	it('nombres: el país en español o inglés, y siglas con mayúsculas exactas', () => {
		expect(namesCountry('Trump wins US election', 'US', 'Estados Unidos')).toBe(true);
		expect(namesCountry('Let us count the votes', 'US', 'Estados Unidos')).toBe(false);
		expect(namesCountry('Resultados en Francia', 'FR', 'Francia')).toBe(true);
		expect(namesCountry('France election results', 'FR', 'Francia')).toBe(true);
		expect(
			electionName({ name: 'Elecciones presidenciales de Francia de 2027', country: 'Francia', kind: 'presidential' })
		).toBe('elecciones presidenciales');
		expect(electionName({ name: 'Francia', country: 'Francia', kind: 'referendum' })).toBe('referéndum');
	});
});

describe('IA', () => {
	// Forma de news-ai.json / news-tech.json: NewsData, con los otros medios del grupo en `also`.
	const item = (title: string, url: string, also: string[], source = 'The Verge') => ({
		title,
		url,
		source,
		time: '2026-10-14T09:00:00.000Z',
		summary: '',
		also: also.map((s, i) => ({ source: s, url: `${url}-${i}` }))
	});
	const news = (...items: ReturnType<typeof item>[]) => ({ items, feeds: [] });

	it('grupo de 3 medios o más con un laboratorio y un lanzamiento; sin repetir entre IA y Tecnología', () => {
		const tech = item('OpenAI unveils GPT-6', 'https://b.com/x', ['Wired', 'Ars']);
		tech.also[0].url = 'https://a.com/gpt6-1';
		const d: Inputs = {
			newsAi: news(
				item('OpenAI launches GPT-6', 'https://a.com/gpt6', ['TechCrunch', 'Wired']),
				item('Anthropic presenta Claude 6', 'https://a.com/claude', ['Xataka']),
				item('Google Gemini, explicado', 'https://a.com/gemini', ['Wired', 'Xataka'])
			),
			newsTech: news(tech)
		};
		const { alerts } = run(aiRule, d);
		expect(alerts).toHaveLength(1);
		expect(alerts[0].title).toBe('IA: OpenAI launches GPT-6');
		expect(alerts[0].body).toBe('The Verge y 2 medios más.\nhttps://a.com/gpt6');
		// Con otro titular principal y alguno de los mismos enlaces, tampoco se repite.
		const log = emptyLog();
		alerts[0].commit!(log);
		const again = { newsAi: news(item('OpenAI releases GPT-6', 'https://a.com/gpt6-0', ['X', 'Y'])) };
		expect(run(aiRule, again, log).ids).toEqual([]);
	});

	it('como mucho 3 al día (cuenta lo intentado hoy en Madrid)', () => {
		const many = (n: number) =>
			news(...Array.from({ length: n }, (_, i) => item(`Meta releases Llama ${i}`, `https://m.com/${i}`, ['A', 'B'])));
		expect(run(aiRule, { newsAi: many(5) }).ids).toHaveLength(3);
		const log = emptyLog();
		log.entries.push(
			{ k: 'ai:x', t: '2026-10-14T07:00Z', s: 'sent', p: 2 },
			{ k: 'ai:y', t: '2026-10-14T08:00Z', s: 'failed', p: 2 },
			{ k: 'ai:z', t: '2026-10-13T08:00Z', s: 'sent', p: 2 }
		);
		expect(run(aiRule, { newsAi: many(5) }, log).ids).toHaveLength(1);
	});
});

// Reglas de avisos de la rama claude/ntfy-extra: conflictos, elecciones, IA, lanzamientos, ajedrez, SEMANA
// y valores seguidos. Las muestras tienen la forma real de cada JSON (ver los tipos citados en cada bloque).
import { describe, expect, it } from 'vitest';
import {
	aiRule,
	chessLine,
	conflictRule,
	earningsRule,
	electionName,
	electionRule,
	emptyLog,
	impRule,
	launchName,
	launchRule,
	madrid,
	morningRule,
	namesCountry,
	stockRule,
	weekRule,
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
	it('P1 si cumple IMP_BIG, P2 con 4 medios o más; texto con medios, secciones y enlace', () => {
		const d: Inputs = {
			imp: {
				current: [
					topic('a', 'Rusia lanza una ofensiva con misiles sobre Kiev', 11, ['geo', 'eco', 'ws']),
					topic('b', 'Israel y Hamás acuerdan un alto el fuego', 5),
					topic('c', 'Ceasefire talks stall', 3),
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

	it('6 h de espera por tema, salvo que pase de P2 a P1', () => {
		const p2 = { imp: { current: [topic('b', 'Tregua en Gaza', 6)] } };
		const first = run(conflictRule, p2);
		const log = emptyLog();
		first.alerts[0].commit!(log);
		expect(run(conflictRule, p2, log, NOW + 5 * HOUR).ids).toEqual([]);
		expect(run(conflictRule, p2, log, NOW + 6 * HOUR).ids).toHaveLength(1);
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

	it('grupo de 2 medios o más con un laboratorio y un lanzamiento; sin repetir entre IA y Tecnología', () => {
		const tech = item('OpenAI unveils GPT-6', 'https://b.com/x', ['Wired', 'Ars']);
		tech.also[0].url = 'https://a.com/gpt6-1';
		const d: Inputs = {
			newsAi: news(
				item('OpenAI launches GPT-6', 'https://a.com/gpt6', ['TechCrunch', 'Wired']),
				item('Anthropic presenta Claude 6', 'https://a.com/claude', []),
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

	it('como mucho 6 al día (cuenta lo intentado hoy en Madrid)', () => {
		const many = (n: number) =>
			news(...Array.from({ length: n }, (_, i) => item(`Meta releases Llama ${i}`, `https://m.com/${i}`, ['A', 'B'])));
		expect(run(aiRule, { newsAi: many(8) }).ids).toHaveLength(6);
		const log = emptyLog();
		log.entries.push(
			{ k: 'ai:x', t: '2026-10-14T07:00Z', s: 'sent', p: 2 },
			{ k: 'ai:y', t: '2026-10-14T08:00Z', s: 'failed', p: 2 },
			{ k: 'ai:z', t: '2026-10-13T08:00Z', s: 'sent', p: 2 }
		);
		expect(run(aiRule, { newsAi: many(8) }, log).ids).toHaveLength(4);
	});
});

const earning = (symbol: string, date: string, epsActual: number | null = null) => ({
	date,
	symbol,
	hour: 'amc',
	quarter: 3,
	year: 2026,
	epsEstimate: 1,
	epsActual,
	revenueEstimate: null,
	revenueActual: null
});

describe('Valores seguidos', () => {
	// Forma de alert-quotes.json (PR #132): Quote[] de src/lib/types.ts. Con el plan gratuito de Finnhub
	// solo vienen los de EE. UU.: los europeos faltan y no pasa nada.
	const quote = (symbol: string, changePct: number | null, time = '2026-10-14T13:30:00.000Z', price = 100) => ({
		symbol,
		price,
		change: changePct,
		changePct,
		prevClose: 101,
		time
	});

	it('±2 % el primero del día; después, otro cada 2 % desde el último aviso, suba o baje', () => {
		const first = run(stockRule, { alertQuotes: [quote('LMT', -4.2), quote('RTX', 1), quote('NVDA', null)] });
		expect(first.ids).toEqual(['stock:LMT:2026-10-14T10:00Z']);
		expect(first.alerts[0].title).toBe('Lockheed Martin −4,2 %');
		expect(first.alerts[0].body).toBe('Variación del día (escalón ±2 %). Cotiza a 100,00; cierre anterior, 101,00.');
		expect(first.alerts[0].click).toBe('https://arc-terminal.pages.dev/s?sym=LMT');
		const log = emptyLog();
		first.alerts[0].commit!(log);
		expect(log.last['stock:LMT']).toBe('2026-10-14|101|100');
		// 98,5 es un −1,5 % desde el último aviso (100): todavía no. 96,9, un −3,1 %: sí, sin esperar.
		const later = NOW + 15 * 60_000;
		expect(run(stockRule, { alertQuotes: [quote('LMT', -2.5, undefined, 98.5)] }, log, later).ids).toEqual([]);
		const down = run(stockRule, { alertQuotes: [quote('LMT', -4.1, undefined, 96.9)] }, log, later);
		expect(down.ids).toEqual(['stock:LMT:2026-10-14T10:15Z']);
		expect(down.alerts[0].body).toBe(
			'Variación del día; −3,1 % desde el último aviso (escalón ±2 %). Cotiza a 96,90; cierre anterior, 101,00.'
		);
		down.alerts[0].commit!(log);
		// Rebote de 96,9 a 100: +3,2 %, también avisa.
		const up = run(stockRule, { alertQuotes: [quote('LMT', -1, undefined, 100)] }, log, later + HOUR);
		expect(up.alerts[0].body).toContain('+3,2 % desde el último aviso');
		expect(up.alerts[0].tags).toBe('chart_with_upwards_trend');
		// El sábado sigue la cotización del viernes: el día es el de la cotización, no se repite.
		const saturday = Date.parse('2026-10-17T10:00:00Z');
		const friday = [quote('LMT', -7, '2026-10-16T20:00:00.000Z')];
		const fri = run(stockRule, { alertQuotes: friday }, emptyLog(), saturday);
		expect(fri.ids).toEqual(['stock:LMT:2026-10-17T10:00Z']);
		const satLog = emptyLog();
		fri.alerts[0].commit!(satLog);
		expect(satLog.last['stock:LMT']).toBe('2026-10-16|101|100');
		expect(run(stockRule, { alertQuotes: friday }, satLog, saturday + HOUR).ids).toEqual([]);
	});

	it('3 o más a la vez van en un solo aviso, solo con los que están', () => {
		const d: Inputs = { alertQuotes: [quote('LMT', -3.5), quote('NOC', -4), quote('GD', -3.1), quote('BA', 0.5)] };
		const { alerts } = run(stockRule, d);
		expect(alerts.map((a) => a.id)).toEqual(['stock:grupo:2026-10-14T10:00Z']);
		expect(alerts[0].body).toBe('Lockheed Martin −3,5 %, Northrop Grumman −4,0 %, General Dynamics −3,1 %');
		const log = emptyLog();
		alerts[0].commit!(log);
		expect(run(stockRule, d, log, NOW + HOUR).ids).toEqual([]);
	});

	it('los de EE. UU. también vigilan sus resultados', () => {
		const finnhub = { earnings: [earning('LMT', '2026-10-14', 6.8)], news: [], quotes: [] };
		expect(run(earningsRule, { finnhub }).ids).toEqual(['earn:LMT:2026-10-14']);
	});
});

describe('Lanzamientos', () => {
	// Forma de launches.json (rama claude/lanzamientos): Launch de src/lib/launches.ts.
	const launch = (id: string, rocket: string, mission: string, provider: string, minutes: number, status = 'Go') => ({
		id,
		mission,
		rocket,
		provider,
		pad: 'Orbital Launch Mount A',
		location: 'Starbase, TX, USA',
		net: new Date(NOW + minutes * 60_000).toISOString(),
		precise: true,
		windowStart: null,
		windowEnd: null,
		status,
		statusName: 'Go for Launch',
		url: 'https://example.org/webcast',
		webcast: true
	});

	it('Go, entre 45 y 75 min antes, y solo los vigilados', () => {
		const d: Inputs = {
			launches: {
				launches: [
					launch('a', 'Starship', 'Starship Flight 12', 'SpaceX', 60),
					launch('b', 'Falcon 9', 'Starlink Group 10-5', 'SpaceX', 60),
					launch('c', 'Falcon 9', 'Crew-12', 'SpaceX', 50),
					launch('d', 'H3', 'HTV-X2', 'Japan Aerospace Exploration Agency', 70, 'TBC'),
					launch('e', 'Ariane 62', 'Galileo L14', 'Arianespace', 30),
					launch('f', 'Long March 5', 'Chang’e 7', 'China National Space Administration', 74)
				]
			}
		};
		const { alerts } = run(launchRule, d);
		expect(alerts.map((a) => a.id)).toEqual([
			`launch:a:${d.launches!.launches![0].net}`,
			`launch:c:${d.launches!.launches![2].net}`,
			`launch:f:${d.launches!.launches![5].net}`
		]);
		expect(alerts[0].title).toBe('🚀 En 1 h: Starship (vuelo 12) desde Starbase, 13:00 hora de Madrid');
		expect(alerts[0].click).toBe('https://example.org/webcast');
		expect(launchName({ rocket: 'Falcon 9', mission: 'Crew-12' })).toBe('Falcon 9 (Crew-12)');
	});
});

describe('Ajedrez en «Buenos días»', () => {
	// Forma de lichess.json (rama claude/chess-extras): Puzzle de src/lib/chess/puzzle.ts.
	const lichess = {
		id: 'Ab12C',
		date: '2026-10-14',
		rating: 1850,
		themes: ['mateIn2', 'short'],
		fen: '8/8/8/8/8/8/8/8 w - - 0 1',
		lastMove: 'e2e4',
		solution: ['d1h5'],
		url: 'https://lichess.org/training/Ab12C'
	};

	it('una línea con el problema de hoy; el de ayer no sale', () => {
		expect(chessLine({ lichess }, '2026-10-14')).toEqual([
			'♟ Problema del día: mate en 2 · dificultad 1850 → https://lichess.org/training/Ab12C'
		]);
		expect(chessLine({ lichess }, '2026-10-15')).toEqual([]);
		const at = Date.parse('2026-10-14T06:05:00Z'); // 08:05 CEST
		expect(run(morningRule, { lichess }, emptyLog(), at).alerts[0].body).toContain('♟ Problema del día');
	});
});

describe('SEMANA', () => {
	// Domingo 18 de octubre de 2026, 19:00 CEST.
	const SUNDAY = Date.parse('2026-10-18T17:00:00Z');
	const entry = (k: string, score: number, media = 6) => ({
		k,
		title: `Tema ${k}`,
		url: `https://example.org/${k}`,
		sources: Array.from({ length: media }, (_, i) => `M${i}`),
		score
	});
	const days = (pts: [string, number][]) => pts.map(([t, v]) => ({ t, v }));
	const d: Inputs = {
		imp: {
			days: [
				{ date: '2026-10-10', items: [entry('viejo', 99)] },
				{ date: '2026-10-12', items: [entry('a', 30), entry('b', 12)] },
				{ date: '2026-10-15', items: [entry('a', 35), entry('c', 20), entry('d', 18)] },
				{ date: '2026-10-18', items: [entry('e', 16), entry('f', 15), entry('g', 2)] }
			]
		},
		ecb: {
			series: [
				{
					id: 'eurusd',
					label: 'EUR/USD',
					unit: '$',
					source: 'BCE',
					points: days([
						['2026-10-09', 1.1],
						['2026-10-16', 1.111]
					])
				}
			]
		},
		uscurve: {
			tenors: ['2A', '10A'],
			days: [
				{ date: '2026-10-09', values: [3.5, 4.1] },
				{ date: '2026-10-16', values: [3.4, 4.22] }
			]
		},
		crypto: { coins: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd: 1, eur: 1, change24h: 5, marketCap: 0 }] },
		finnhub: { earnings: [earning('LMT', '2026-10-20')], news: [], quotes: [] }
	};

	it('domingo desde las 19:00 de Madrid: top 5 de IMP de 7 días, cambio semanal y la semana que viene', () => {
		expect(run(weekRule, d, emptyLog(), SUNDAY - 60_000).ids).toEqual([]);
		expect(run(weekRule, d, emptyLog(), SUNDAY - 86_400_000).ids).toEqual([]);
		const { alerts } = run(weekRule, d, emptyLog(), SUNDAY);
		expect(alerts.map((a) => a.id)).toEqual(['week:2026-10-18']);
		expect(alerts[0].markdown).toBe(true);
		expect(alerts[0].body).toBe(
			[
				'**Lo más importante de la semana**',
				'1. Tema a (6 medios)',
				'2. Tema c (6 medios)',
				'3. Tema d (6 medios)',
				'4. Tema e (6 medios)',
				'5. Tema f (6 medios)',
				'',
				'**Mercados en la semana**',
				'EUR/USD +1,0 % · US10Y +12 pb',
				'',
				'**La semana que viene**',
				'- Martes 20 de octubre: Resultados de LMT (tras el cierre)'
			].join('\n')
		);
	});
});

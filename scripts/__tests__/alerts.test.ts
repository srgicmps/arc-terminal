import { describe, expect, it } from 'vitest';
import type { SourceHistory, SourceStatus } from '../../src/lib/data.ts';
import type { FuelData, FuelPrices, FuelSpainData, FuelStation } from '../../src/lib/fuel.ts';
import type {
	Chokepoint,
	HolidaysData,
	PowerData,
	PowerDay,
	Prediction,
	PricePoint,
	Quake,
	SeriesData
} from '../../src/lib/types.ts';
import { appendSpan } from '../history.ts';
import {
	addDays,
	cheapestDiesel,
	dieselDayRule,
	dieselExtremeRule,
	dieselGapRule,
	dieselLines,
	dstRule,
	downRule,
	earningsRule,
	emptyLog,
	euriborText,
	eveningRule,
	fedregRule,
	gasRule,
	impRule,
	lastSunday,
	luzRule,
	macroRule,
	madrid,
	marketRule,
	morningRule,
	periodName,
	polyRule,
	quakeRule,
	rateRule,
	readAsset,
	RULES,
	straitRule,
	tomorrowRule,
	typicalPayment,
	type FuelZone,
	type Inputs,
	type NotifyLog,
	type Rule,
	type RuleContext
} from '../alerts/rules.ts';
import { ASSETS } from '../alerts/config.ts';

// 14 oct 2026, 12:00 en Madrid (CEST).
const NOW = Date.parse('2026-10-14T10:00:00Z');
const HOUR = 3_600_000;

/** Ejecuta una regla y devuelve sus avisos y el historial con los cambios «siempre» ya aplicados. */
function run(rule: Rule['run'], d: Inputs, log: NotifyLog = emptyLog(), now = NOW) {
	const updates: ((l: NotifyLog) => void)[] = [];
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: (fn) => void updates.push(fn) };
	const alerts = rule(d, ctx);
	const after = structuredClone(log);
	for (const fn of updates) fn(after);
	return { alerts, ids: alerts.map((a) => a.id), after };
}

const quake = (id: string, mag: number, hoursAgo = 1, tsunami = false): Quake => ({
	id,
	mag,
	place: 'Lugar de prueba',
	time: new Date(NOW - hoursAgo * HOUR).toISOString(),
	url: '',
	tsunami,
	alert: null,
	lat: 0,
	lon: 0,
	depth: 10
});

const series = (id: string, points: [string, number][]): SeriesData => ({
	series: [{ id, label: id, unit: '%', points: points.map(([t, v]) => ({ t, v })), source: 'X' }]
});

const withLast = (last: Record<string, string>): NotifyLog => ({ ...emptyLog(), last });

describe('RULES', () => {
	it('niveles: P1 terremoto, tipos, IMP y estrechos; P2 macro, mercados, Federal Register y gas; P3 y P4', () => {
		expect(RULES.map((r) => `${r.level}:${r.type}`)).toEqual([
			'1:quake',
			'1:rate',
			'1:imp',
			'1:strait',
			'1:war',
			'1:conflict',
			'2:macro',
			'2:market',
			'2:fedreg',
			'2:gas',
			'2:diesel-day',
			'2:diesel-extreme',
			'2:diesel-gap',
			'2:election',
			'2:ai',
			'2:stock',
			'2:hy',
			'2:liquidity',
			'3:poly',
			'3:earnings',
			'3:down',
			'3:luz',
			'3:tomorrow',
			'3:dst',
			'3:launch',
			'4:morning',
			'4:evening',
			'4:week',
			// scripts/alerts/world.ts
			'1:gdacs',
			'1:blackout',
			'1:ioda',
			'2:status',
			'2:who'
		]);
	});

	it('sin ningún dato, ninguna regla falla ni avisa (los JSON que faltan no aplican)', () => {
		for (const rule of RULES)
			expect(run(rule.run, {}, emptyLog(), Date.parse('2026-10-14T03:00:00Z')).alerts).toEqual([]);
	});
});

describe('P1', () => {
	it('terremoto M6,5+ o M6+ con tsunami, de las últimas 24 h', () => {
		const { ids, alerts } = run(quakeRule, {
			quakes: [
				quake('a', 7.1),
				quake('b', 6.4),
				quake('c', 6.2, 1, true),
				quake('d', 5.9, 1, true),
				quake('e', 7.5, 30)
			]
		});
		expect(ids).toEqual(['quake:a', 'quake:c']);
		expect(alerts[0].title).toBe('Terremoto M7,1 · Lugar de prueba');
		expect(alerts[1].body).toContain('Aviso de tsunami');
	});

	it('tipos: la primera vez se apunta; si cambia, avisa con la diferencia en pb', () => {
		const ecb = series('ecb-dfr', [
			['2026-10-28', 2],
			['2026-10-29', 1.75]
		]);
		const first = run(rateRule, { ecb });
		expect(first.ids).toEqual([]);
		expect(first.after.last['rate:ecb-dfr']).toBe('1.75');
		const changed = run(rateRule, { ecb }, withLast({ 'rate:ecb-dfr': '2' }));
		expect(changed.ids).toEqual(['rate:ecb-dfr:2026-10-29:1.75']);
		expect(changed.alerts[0].title).toBe('BCE baja tipos: 1,75 %');
		expect(changed.alerts[0].body).toContain('(−25 pb)');
		const log = withLast({ 'rate:ecb-dfr': '2' });
		changed.alerts[0].commit!(log);
		expect(run(rateRule, { ecb }, log).ids).toEqual([]);
	});

	it('tipos de la Fed, el BoE y el BoJ salen del BIS', () => {
		const bis: SeriesData = {
			series: [
				...series('policy-gb', [
					['2026-08', 4],
					['2026-10', 4.25]
				]).series,
				...series('policy-jp', [['2026-01', 0.75]]).series
			]
		};
		const { alerts } = run(rateRule, { bis }, withLast({ 'rate:policy-gb': '4', 'rate:policy-jp': '0.75' }));
		expect(alerts.map((a) => a.title)).toEqual(['BoE sube tipos: 4,25 %']);
	});

	it('IMP: 6 medios o más en 3 secciones o más', () => {
		const t = (k: string, media: number, sections: number) => ({
			k,
			title: k,
			score: 30,
			sources: Array.from({ length: media }, (_, i) => `m${i}`),
			sections: Array.from({ length: sections }, (_, i) => `s${i}`)
		});
		expect(run(impRule, { imp: { current: [t('a', 6, 3), t('b', 5, 4), t('c', 9, 2)] } }).ids).toEqual(['imp:a']);
	});

	it('estrecho: avisa al caer más de un 50 % frente a la semana anterior, y no repite hasta que se recupera', () => {
		const point = (avg7: number, name = 'Ormuz'): Chokepoint => ({
			id: 'chokepoint6',
			name,
			last: '2026-10-13',
			avg7,
			avg7PrevYear: null,
			change: null,
			spark: [...Array(10).fill(100), avg7]
		});
		const low = run(straitRule, { portwatch: [point(40)] });
		expect(low.ids).toEqual(['strait:chokepoint6:2026-10-13']);
		expect(low.alerts[0].title).toBe('Ormuz: tránsitos −60 %');
		expect(run(straitRule, { portwatch: [point(60)] }).ids).toEqual([]);
		expect(run(straitRule, { portwatch: [point(40, 'Malaca')] }).ids).toEqual([]);
		const log = emptyLog();
		low.alerts[0].commit!(log);
		expect(run(straitRule, { portwatch: [point(30)] }, log).ids).toEqual([]);
		const back = run(straitRule, { portwatch: [point(90)] }, log);
		expect(back.after.last['strait:chokepoint6']).toBeUndefined();
	});
});

describe('P2', () => {
	it('macro: periodo nuevo con valor, el anterior y la diferencia; la primera vez solo se apunta', () => {
		const d = {
			ine: series('ipc-es', [
				['2026-08', 2.7],
				['2026-09', 2.9]
			])
		};
		expect(run(macroRule, d).ids).toEqual([]);
		expect(run(macroRule, d).after.last['macro:ipc-es']).toBe('2026-09');
		const { alerts } = run(macroRule, d, withLast({ 'macro:ipc-es': '2026-08' }));
		expect(alerts.map((a) => a.id)).toEqual(['macro:ipc-es:2026-09']);
		expect(alerts[0].title).toBe('IPC de España: 2,9 %');
		expect(alerts[0].body).toBe('septiembre de 2026 (INE). Anterior: 2,7 % (+20 pb).');
		expect(run(macroRule, d, withLast({ 'macro:ipc-es': '2026-09' })).ids).toEqual([]);
	});

	it('macro: nóminas con signo y PIB trimestral', () => {
		const bls = series('payrolls-us', [
			['2026-08', 120],
			['2026-09', -35]
		]);
		const fred = series('gdp-us', [
			['2026-Q1', 1.2],
			['2026-Q2', 2.4]
		]);
		const { alerts } = run(
			macroRule,
			{ bls, fred },
			withLast({ 'macro:payrolls-us': '2026-08', 'macro:gdp-us': '2026-Q1' })
		);
		expect(alerts.map((a) => a.title)).toEqual([
			'Nóminas de EE. UU.: −35 mil empleos',
			'PIB de EE. UU. (anualizado): 2,4 %'
		]);
		expect(periodName('2026-Q2')).toBe('2.º trimestre de 2026');
	});

	const crypto = (btc: number, eth = 0, usd = 60000) => ({
		coins: [
			{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd, eur: 0, change24h: btc, marketCap: 0 },
			{ id: 'ethereum', symbol: 'ETH', name: 'Ether', usd: 3000, eur: 0, change24h: eth, marketCap: 0 }
		]
	});

	it('mercados: umbrales «B» (BTC ±2,5 %)', () => {
		expect(run(marketRule, { crypto: crypto(-2.4) }).ids).toEqual([]);
		const { alerts } = run(marketRule, { crypto: crypto(-4.1) });
		expect(alerts.map((a) => a.title)).toEqual(['Mercados: BTC −4,1 %']);
	});

	it('mercados: sin espera, por escalones desde el último aviso, suba o baje', () => {
		// 1.º del día: −4 % desde el cierre (60.000 → 57.600).
		const first = run(marketRule, { crypto: crypto(-4, 0, 57600) });
		expect(first.alerts.map((a) => a.title)).toEqual(['Mercados: BTC −4,0 %']);
		expect(first.alerts[0].body).toBe('Movimiento del día (escalón ±2,5 %).');
		const log = emptyLog();
		first.alerts[0].commit!(log);
		expect(log.last['mkt:BTC']).toBe('2026-10-14|60000|57600');
		// A los 15 min: −1,9 % desde el último aviso, todavía no; −3,6 %, sí (aunque no haya pasado ninguna espera).
		expect(run(marketRule, { crypto: crypto(-5.8, 0, 56500) }, log, NOW + 15 * 60_000).ids).toEqual([]);
		const second = run(marketRule, { crypto: crypto(-7.5, 0, 55500) }, log, NOW + 15 * 60_000);
		expect(second.alerts[0].title).toBe('Mercados: BTC −7,5 %');
		expect(second.alerts[0].body).toBe('Movimiento del día; −3,6 % desde el último aviso (escalón ±2,5 %).');
		second.alerts[0].commit!(log);
		// Rebote: +3,6 % desde el último aviso también avisa, aunque en el día siga en negativo.
		const third = run(marketRule, { crypto: crypto(-4.2, 0, 57500) }, log, NOW + 30 * 60_000);
		expect(third.alerts[0].body).toBe('Movimiento del día; +3,6 % desde el último aviso (escalón ±2,5 %).');
		expect(third.alerts[0].tags).toBe('chart_with_upwards_trend');
		third.alerts[0].commit!(log);
		expect(run(marketRule, { crypto: crypto(-4.2, 0, 57500) }, log, NOW + HOUR).ids).toEqual([]);
		// Al día siguiente se reinicia: vuelve a contar desde el cierre anterior.
		const tomorrow = NOW + 24 * HOUR;
		expect(run(marketRule, { crypto: crypto(-3.6, 0, 57400) }, log, tomorrow).alerts[0].body).toBe(
			'Movimiento del día (escalón ±2,5 %).'
		);
		expect(run(marketRule, { crypto: crypto(-1, 0, 57400) }, log, tomorrow).ids).toEqual([]);
	});

	it('mercados: en pb, el escalón es en puntos básicos; un dato que no cambia no repite', () => {
		const curve = (v: number) => ({
			tenors: ['10A'],
			days: [
				{ date: '2026-10-13', values: [4.0] },
				{ date: '2026-10-14', values: [v] }
			]
		});
		const first = run(marketRule, { uscurve: curve(4.09) });
		expect(first.alerts[0].title).toBe('Mercados: US10Y +9 pb');
		const log = emptyLog();
		first.alerts[0].commit!(log);
		expect(run(marketRule, { uscurve: curve(4.09) }, log, NOW + 6 * HOUR).ids).toEqual([]);
		expect(run(marketRule, { uscurve: curve(4.13) }, log).ids).toEqual([]);
		const next = run(marketRule, { uscurve: curve(4.17) }, log);
		expect(next.alerts[0].body).toBe('Movimiento del día; +8 pb desde el último aviso (escalón ±5 pb).');
	});

	it('mercados: 3 o más a la vez van juntos en un solo aviso', () => {
		const d: Inputs = {
			crypto: crypto(-4.1),
			ecb: series('eurusd', [
				['2026-10-13', 1.1],
				['2026-10-14', 1.0923]
			]),
			uscurve: {
				tenors: ['2A', '10A'],
				days: [
					{ date: '2026-10-13', values: [3.5, 4.0] },
					{ date: '2026-10-14', values: [3.6, 4.09] }
				]
			}
		};
		const { alerts } = run(marketRule, d);
		expect(alerts).toHaveLength(1);
		expect(alerts[0].title).toBe('Mercados');
		expect(alerts[0].body).toBe('BTC −4,1 %, EUR/USD −0,7 %, US10Y +9 pb');
		const log = emptyLog();
		alerts[0].commit!(log);
		expect(Object.keys(log.last)).toEqual(['mkt:BTC', 'mkt:EUR/USD', 'mkt:US10Y']);
		// La agrupación se mantiene en los escalones siguientes, con lo que se ha movido desde el último aviso.
		const more: Inputs = {
			crypto: crypto(-8, 0, 55000),
			ecb: series('eurusd', [
				['2026-10-13', 1.1],
				['2026-10-14', 1.0834]
			]),
			uscurve: {
				tenors: ['2A', '10A'],
				days: [
					{ date: '2026-10-13', values: [3.5, 4.0] },
					{ date: '2026-10-14', values: [3.6, 4.17] }
				]
			}
		};
		expect(run(marketRule, more, log, NOW + HOUR).alerts[0].body).toBe(
			'BTC −8,0 % (−8,3 % desde el último aviso), EUR/USD −1,5 % (−0,8 % desde el último aviso), ' +
				'US10Y +17 pb (+8 pb desde el último aviso)'
		);
	});

	it('mercados: las primas de riesgo solo cuentan al subir; sin datos, el activo no aplica', () => {
		const ecb: SeriesData = {
			series: [
				...series('bond10-de', [
					['2026-08', 2.5],
					['2026-09', 2.5]
				]).series,
				...series('bond10-it', [
					['2026-08', 3.5],
					['2026-09', 3.62]
				]).series,
				...series('bond10-es', [
					['2026-08', 3.3],
					['2026-09', 3.1]
				]).series
			]
		};
		const first = run(marketRule, { ecb });
		expect(first.alerts.map((a) => a.title)).toEqual(['Mercados: Prima IT +12 pb']);
		expect(first.alerts[0].body).toBe('Movimiento del día (escalón +6 pb).');
		const dax = ASSETS.find((a) => a.name === 'DAX')!;
		expect(readAsset(dax, {})).toBeNull();
	});

	it('Federal Register: sanciones o aranceles de hoy, uno al día y el más relevante', () => {
		const doc = (id: string, title: string, date = '2026-10-14') => ({
			id,
			title,
			type: '',
			subtype: '',
			abstract: '',
			agencies: ['Executive Office of the President'],
			date,
			url: '',
			pdf: ''
		});
		const fedreg = {
			presidential: [
				doc('p1', 'Adjusting Imports of Steel Into the United States'),
				doc('p2', 'Imposing Reciprocal Tariffs on All Trading Partners')
			],
			rules: [doc('r1', 'Sanctions Regulations Amendment'), doc('r2', 'New Tariffs', '2026-10-13')]
		};
		const { alerts } = run(fedregRule, { fedreg });
		expect(alerts.map((a) => a.id)).toEqual(['fedreg:2026-10-14']);
		expect(alerts[0].body).toContain('Reciprocal Tariffs');
	});

	it('gas UE (cuando exista gie.json): baja 1 punto o más, o cruza el 90, 80 o 50 %', () => {
		const gie = (a: number, b: number) => ({
			days: [
				{ date: '2026-10-13', full: a },
				{ date: '2026-10-14', full: b }
			]
		});
		expect(run(gasRule, { gie: gie(85, 84.5) }).ids).toEqual([]);
		expect(run(gasRule, { gie: gie(85, 83.9) }).ids).toEqual(['gas:2026-10-14']);
		expect(run(gasRule, { gie: gie(89.8, 90.2) }).alerts[0].body).toContain('cruza el 90 %');
		expect(run(gasRule, { gie: { eu: gie(80.4, 79.9) } }).ids).toEqual(['gas:2026-10-14']);
	});
});

// ---------- Diésel ----------

/** Precios con la forma de FuelPrices (src/lib/fuel.ts): solo importa el diésel. */
const prices = (diesel: number | null): FuelPrices => ({ g95: 1.6, diesel, g98: 1.75, glp: 0.9 });

/** Días seguidos que acaban el 14 oct 2026; `value(i)` da el diésel del día i (0 = el más antiguo). */
const days = (n: number, value: (i: number, date: string) => number, end = '2026-10-14') =>
	Array.from({ length: n }, (_, i) => {
		const date = addDays(end, i - n + 1);
		return { date, v: value(i, date) };
	});

/** fuel-es.json con la media de España y, si se da, la provincia 07 en el historial. */
function fuelEs(es: { date: string; v: number }[], zone07?: { date: string; v: number }[]): FuelSpainData {
	const z = new Map(zone07?.map((p) => [p.date, p.v]));
	const last = es.at(-1)?.v ?? null;
	return {
		sourceDate: '14/10/2026 12:30:05',
		avg: prices(last),
		provinces: [
			{ id: '07', name: 'Illes Balears', count: 180, lat: 39.6, lon: 2.9, avg: prices(1.5), min: prices(1.39) },
			{ id: '28', name: 'Madrid', count: 800, lat: 40.4, lon: -3.7, avg: prices(1.42), min: prices(1.3) }
		],
		history: es.map((p) => ({
			date: p.date,
			avg: prices(p.v),
			provinces: {
				'28': prices(1.42),
				...(z.has(p.date) ? { '07': prices(z.get(p.date)!) } : {})
			} as Record<string, FuelPrices>
		}))
	};
}

const station = (name: string, town: string, diesel: number | null): FuelStation => ({
	id: name,
	name,
	address: 'Calle de prueba 1',
	town,
	schedule: 'L-D: 24H',
	lat: 39.9,
	lon: 4.2,
	prices: prices(diesel)
});

const ZONE_07: FuelZone = {
	id: '07',
	name: 'Illes Balears',
	stations: [station('Cara', 'Palma', 1.52), station('Barata', 'Inca', 1.399), station('Sin diésel', 'Sóller', null)]
};

describe('P2: diésel', () => {
	it('a) cambio diario: cualquier cambio frente a ayer, con la diferencia de 7 días; sin cambio, nada', () => {
		// Hace 7 días, 1,424; ayer, 1,408; hoy, 1,412.
		const es = days(14, (i) => (i === 13 ? 1.412 : i === 12 ? 1.408 : 1.424));
		const { alerts } = run(dieselDayRule, { fuelEs: fuelEs(es) });
		expect(alerts.map((a) => a.id)).toEqual(['diesel:day:es:2026-10-14']);
		expect(alerts[0].title).toBe('Diésel en España: 1,412 €/L (+0,4 cts frente a ayer · −1,2 en 7 días)');
		expect(alerts[0].body).toBe(
			'Precio medio del 14 de octubre; el anterior, 1,408 €/L (Ministerio para la Transición Ecológica).'
		);
		// Una décima de céntimo ya cuenta; si no cambia, no se avisa.
		expect(run(dieselDayRule, { fuelEs: fuelEs(days(3, (i) => (i === 2 ? 1.401 : 1.4))) }).alerts[0].title).toBe(
			'Diésel en España: 1,401 €/L (+0,1 cts frente a ayer)'
		);
		expect(run(dieselDayRule, { fuelEs: fuelEs(days(14, () => 1.4)) }).ids).toEqual([]);
		// Con un solo día no hay con qué comparar.
		expect(run(dieselDayRule, { fuelEs: fuelEs(es.slice(-1)) }).ids).toEqual([]);
	});

	it('a) sin espera: cada dato nuevo avisa una vez (el id lleva la fecha); si falta un día, lo dice', () => {
		const a = days(5, (i) => 1.4 + i / 1000);
		expect(run(dieselDayRule, { fuelEs: fuelEs(a) }).ids).toEqual(['diesel:day:es:2026-10-14']);
		const b = days(6, (i) => 1.4 + i / 1000, '2026-10-15');
		expect(run(dieselDayRule, { fuelEs: fuelEs(b) }).ids).toEqual(['diesel:day:es:2026-10-15']);
		const gap = [...a.slice(0, 3), a[4]];
		expect(run(dieselDayRule, { fuelEs: fuelEs(gap) }).alerts[0].title).toBe(
			'Diésel en España: 1,404 €/L (+0,2 cts frente al 12 de octubre)'
		);
	});

	it('a) también en la zona (Menorca sale de fuel.json)', () => {
		const fuel: FuelData = {
			sourceDate: '14/10/2026 12:30:05',
			stations: [station('Barata', 'Maó', 1.45)],
			history: days(14, (i) => (i < 13 ? 1.5 : 1.46)).map((p) => ({ date: p.date, avg: prices(p.v), min: prices(1.4) }))
		};
		const d: Inputs = { fuelEs: fuelEs(days(14, () => 1.4)), fuel, zone: { id: 'menorca', name: 'Menorca' } };
		const { ids, alerts } = run(dieselDayRule, d);
		expect(ids).toEqual(['diesel:day:zona:2026-10-14']);
		expect(alerts[0].title).toBe('Diésel en Menorca: 1,460 €/L (−4,0 cts frente a ayer · −4,0 en 7 días)');
	});

	it('b) mínimo de 90 días, con el mes de la última vez que estuvo así de bajo', () => {
		// Desde el 1 de junio: 1,450, con un 1,385 el 10 de julio; en los últimos 90 días, de 1,400 a 1,450; hoy 1,389.
		const s = days(136, (i, date) =>
			date === '2026-10-14' ? 1.389 : date === '2026-07-10' ? 1.385 : date >= '2026-07-17' ? 1.4 + (i % 6) / 100 : 1.45
		);
		const { alerts } = run(dieselExtremeRule, { fuelEs: fuelEs(s) });
		expect(alerts.map((a) => a.id)).toEqual(['diesel:low:es:2026-10-14']);
		expect(alerts[0].title).toBe('Diésel en España, en su mínimo desde julio: 1,389 €/L');
		expect(alerts[0].body).toContain('Precio medio del 14 de octubre');
		// Sin historial de 90 días no hay mínimo de 90 días.
		expect(run(dieselExtremeRule, { fuelEs: fuelEs(s.slice(-80)) }).ids).toEqual([]);
		// Si nunca estuvo tan bajo, lo dice con los días de historial.
		const never = s.map((p) => (p.date === '2026-07-10' ? { ...p, v: 1.45 } : p));
		expect(run(dieselExtremeRule, { fuelEs: fuelEs(never) }).alerts[0].title).toBe(
			'Diésel en España, en su mínimo de los últimos 136 días: 1,389 €/L'
		);
		// Igualar el mínimo no cuenta.
		const tie = s.map((p) => (p.date === '2026-10-14' ? { ...p, v: 1.4 } : p));
		expect(run(dieselExtremeRule, { fuelEs: fuelEs(tie) }).ids).toEqual([]);
	});

	it('b) máximo de 90 días en la zona; sin espera, con cada dato nuevo', () => {
		const es = days(100, () => 1.42);
		const zone = days(100, (i) => (i === 99 ? 1.61 : 1.5 + (i % 3) / 100));
		const d: Inputs = { fuelEs: fuelEs(es, zone), zone: ZONE_07 };
		const { alerts } = run(dieselExtremeRule, d);
		expect(alerts.map((a) => a.title)).toEqual([
			'Diésel en Illes Balears, en su máximo de los últimos 100 días: 1,610 €/L'
		]);
		expect(alerts[0].id).toBe('diesel:high:zona:2026-10-14');
		// Al día siguiente, otro máximo vuelve a avisar (antes había que esperar una semana).
		const next = { fuelEs: fuelEs(days(101, () => 1.42, '2026-10-15'), [...zone.slice(1), { date: '2026-10-15', v: 1.62 }]), zone: ZONE_07 };
		expect(run(dieselExtremeRule, next).ids).toEqual(['diesel:high:zona:2026-10-15']);
	});

	it('c) la zona se separa 5 cts o más de la media de España; sin espera, un aviso por dato', () => {
		const es = days(3, () => 1.44);
		const d = (v: number): Inputs => ({
			fuelEs: fuelEs(
				es,
				days(3, () => v)
			),
			zone: ZONE_07
		});
		const { alerts } = run(dieselGapRule, d(1.512));
		expect(alerts.map((a) => a.id)).toEqual(['diesel:gap:2026-10-14']);
		expect(alerts[0].title).toBe('Diésel en Illes Balears: +7,2 cts por encima de España');
		expect(alerts[0].body).toBe(
			'1,512 €/L frente a 1,440 €/L de media en España (Ministerio para la Transición Ecológica).'
		);
		expect(run(dieselGapRule, d(1.385)).alerts[0].title).toBe('Diésel en Illes Balears: −5,5 cts por debajo de España');
		expect(run(dieselGapRule, d(1.48)).ids).toEqual([]);
		expect(
			run(dieselGapRule, {
				fuelEs: fuelEs(
					es,
					days(3, () => 1.6)
				)
			}).ids
		).toEqual([]); // sin zona
		expect(alerts[0].commit).toBeUndefined(); // no guarda nada: el id (con la fecha) basta
	});

	it('los ids y las claves del historial dicen «zona», nunca cuál', () => {
		const d: Inputs = {
			fuelEs: fuelEs(
				days(14, (i) => (i < 13 ? 1.4 : 1.435)),
				days(14, (i) => (i < 13 ? 1.5 : 1.6))
			),
			zone: ZONE_07
		};
		const all = [dieselDayRule, dieselGapRule].flatMap((rule) => run(rule, d).alerts);
		expect(all.map((a) => a.id)).toEqual([
			'diesel:day:es:2026-10-14',
			'diesel:day:zona:2026-10-14',
			'diesel:gap:2026-10-14'
		]);
		const log = emptyLog();
		for (const a of all) a.commit?.(log);
		expect(JSON.stringify(log)).not.toMatch(/07|Balears/);
	});

	it('«Buenos días» lleva siempre el diésel y la gasolinera más barata de la zona', () => {
		const es = days(14, (i) => (i === 13 ? 1.412 : 1.424));
		const d: Inputs = {
			fuelEs: fuelEs(
				es,
				days(14, () => 1.5)
			),
			zone: ZONE_07
		};
		const at = Date.parse('2026-10-14T06:05:00Z'); // 08:05 CEST
		const body = run(morningRule, d, emptyLog(), at).alerts[0].body;
		expect(body).toContain('**Vida diaria**');
		expect(body).toContain('- Diésel: 1,412 €/L (−1,2 cts en 7 días)');
		expect(body).toContain('- Diésel en Illes Balears: 1,500 €/L (0,0 cts en 7 días)');
		expect(body).toContain('- Más barato en Illes Balears: Barata (Inca), 1,399 €/L');
		expect(cheapestDiesel(undefined)).toBeNull();
		expect(dieselLines({ fuelEs: fuelEs(es.slice(-3)) })).toEqual(['Diésel: 1,412 €/L']);
	});
});

describe('P3', () => {
	const market = (p: number, volume = 2e6): Prediction => ({
		id: 'm1',
		title: '¿Alto el fuego?',
		url: '',
		volume24h: volume,
		endDate: '',
		outcomes: [
			{ label: 'Sí', p },
			{ label: 'No', p: 1 - p }
		]
	});

	it('Polymarket: guarda una foto cada 4 h y avisa si cambia 10 puntos o más frente a hace ~24 h', () => {
		const first = run(polyRule, { predictions: { geopolitics: [market(0.3)], economy: [] } });
		expect(first.ids).toEqual([]);
		expect(first.after.poly.m1).toHaveLength(1);
		const later = run(
			polyRule,
			{ predictions: { geopolitics: [market(0.31)], economy: [] } },
			first.after,
			NOW + 2 * HOUR
		);
		expect(later.after.poly.m1).toHaveLength(1);
		const next = run(
			polyRule,
			{ predictions: { geopolitics: [market(0.5)], economy: [] } },
			first.after,
			NOW + 24 * HOUR
		);
		expect(next.ids).toEqual(['poly:m1:2026-10-15']);
		expect(next.alerts[0].title).toBe('Polymarket: +20 puntos');
		expect(
			run(polyRule, { predictions: { geopolitics: [market(0.38)], economy: [] } }, first.after, NOW + 24 * HOUR).ids
		).toEqual([]);
		expect(
			run(polyRule, { predictions: { geopolitics: [market(0.6, 1000)], economy: [] } }, first.after, NOW + 24 * HOUR)
				.ids
		).toEqual([]);
	});

	it('resultados de las grandes el día que presentan, cuando ya hay BPA', () => {
		const e = (symbol: string, epsActual: number | null, date = '2026-10-14') => ({
			date,
			symbol,
			hour: 'amc',
			quarter: 3,
			year: 2026,
			epsEstimate: 1,
			epsActual,
			revenueEstimate: 5e10,
			revenueActual: epsActual ? 5.2e10 : null
		});
		const finnhub = {
			earnings: [e('NVDA', 1.1), e('MSFT', null), e('KO', 4), e('AAPL', 2, '2026-10-13')],
			news: [],
			quotes: []
		};
		const { alerts } = run(earningsRule, { finnhub });
		expect(alerts.map((a) => a.id)).toEqual(['earn:NVDA:2026-10-14']);
		expect(alerts[0].body).toBe('BPA 1,10 $ (previsto 1,00) · ingresos 52,0 mil M$ (previstos 50,0).');
	});

	it('fuente caída: cuando issues.ts abriría el issue (3 pasadas en error)', () => {
		const down = (name: string, runs: number): { status: SourceStatus; history: SourceHistory } => {
			let spans = appendSpan(undefined, 'error', NOW - runs * 15 * 60_000);
			for (let i = 1; i < runs; i++) spans = appendSpan(spans, 'error', NOW - (runs - i) * 15 * 60_000);
			return {
				status: { name, label: `Etiqueta ${name}`, state: 'error', fetchedAt: null, error: 'HTTP 500' },
				history: { name, lastRun: '', history: spans }
			};
		};
		const a = down('fred', 3);
		const b = down('bls', 2);
		const { alerts } = run(downRule, { status: [a.status, b.status], history: [a.history, b.history] });
		expect(alerts.map((x) => x.id)).toEqual([`down:fred:${a.history.history[0].t}`]);
		expect(alerts[0].body).not.toContain('HTTP 500');
	});
});

// ---------- P3: vida diaria ----------

/** 24 horas de PVPC de un día, con la forma de power.json (€/MWh, hora de Madrid). */
const pvpcDay = (date: string, mwh: (hour: number) => number): PricePoint[] =>
	Array.from({ length: 24 }, (_, h) => ({
		t: `${date}T${String(h).padStart(2, '0')}:00:00.000+02:00`,
		v: mwh(h)
	}));

/** Historial de power.json: `n` días seguidos hasta el 14 oct con la misma media (€/kWh). */
const powerHistory = (n: number, avg: number): PowerDay[] =>
	days(n, () => avg).map((p) => ({ date: p.date, avg, min: avg / 2, max: avg * 2 }));

describe('P3: vida diaria', () => {
	it('a) luz de mañana un 30 % o más por debajo de la media de 30 días, con la hora más barata', () => {
		const power: PowerData = {
			pvpc: [...pvpcDay('2026-10-14', () => 130), ...pvpcDay('2026-10-15', (h) => (h === 14 ? 40 : 80))],
			spot: [],
			history: powerHistory(30, 0.13)
		};
		const { alerts } = run(luzRule, { power });
		expect(alerts.map((a) => a.id)).toEqual(['luz:2026-10-15']);
		expect(alerts[0].title).toBe('Luz de mañana: −40 % (0,078 €/kWh)');
		expect(alerts[0].body).toBe(
			'Media del PVPC de mañana: 0,078 €/kWh, frente a 0,130 €/kWh de media de 30 días (Red Eléctrica). La hora más barata, las 14 h (0,040 €/kWh).'
		);
		// Mañana aún no publicada (antes de las 20:15): no aplica.
		expect(run(luzRule, { power: { ...power, pvpc: pvpcDay('2026-10-14', () => 130) } }).ids).toEqual([]);
	});

	it('a) luz de mañana por encima, del historial; con menos de 30 días usa lo que haya (mínimo 3)', () => {
		const tomorrow = { date: '2026-10-15', avg: 0.18, min: 0.1, max: 0.3 };
		const power = (n: number, avg = 0.13): PowerData => ({
			pvpc: [],
			spot: [],
			history: [...powerHistory(n, avg), tomorrow]
		});
		const five = run(luzRule, { power: power(5) });
		expect(five.alerts[0].title).toBe('Luz de mañana: +38 % (0,180 €/kWh)');
		expect(five.alerts[0].body).toContain('de media de los últimos 5 días');
		expect(run(luzRule, { power: power(2) }).ids).toEqual([]);
		expect(run(luzRule, { power: power(30, 0.15) }).ids).toEqual([]); // +20 %
	});

	it('b) mañana es festivo (holidays.json), desde las 19:00 de la víspera', () => {
		const holidays: HolidaysData = { items: [{ date: '2026-10-12', name: 'Fiesta Nacional de España', scope: 'ES' }] };
		const at = Date.parse('2026-10-11T17:00:00Z'); // domingo 11, 19:00 CEST
		const { alerts } = run(tomorrowRule, { holidays }, emptyLog(), at);
		expect(alerts.map((a) => a.id)).toEqual(['manana:2026-10-12']);
		expect(alerts[0].title).toBe('Mañana es festivo: Fiesta Nacional de España');
		expect(alerts[0].body).toBe('Lunes 12 de octubre. Festivo en España: Fiesta Nacional de España.');
		expect(run(tomorrowRule, { holidays }, emptyLog(), at - 60_000).ids).toEqual([]);
	});

	it('b) mañana no abre NYSE o BME; con festivo y bolsas cerradas, todo en un aviso', () => {
		const thanksgiving = run(tomorrowRule, {}, emptyLog(), Date.parse('2026-11-25T19:00:00Z'));
		expect(thanksgiving.alerts[0].title).toBe('Mañana no abre la bolsa de Nueva York (NYSE)');
		expect(thanksgiving.alerts[0].body).toBe(
			'Jueves 26 de noviembre. Sin bolsa en Nueva York (NYSE): Acción de Gracias.'
		);
		const holidays: HolidaysData = { items: [{ date: '2026-12-25', name: 'Navidad', scope: 'ES' }] };
		const xmas = run(tomorrowRule, { holidays }, emptyLog(), Date.parse('2026-12-24T19:00:00Z'));
		expect(xmas.ids).toEqual(['manana:2026-12-25']);
		expect(xmas.alerts[0].body).toBe(
			'Viernes 25 de diciembre. Festivo en España: Navidad. Sin bolsa en Nueva York (NYSE): Navidad. Sin bolsa en Madrid (BME): Navidad.'
		);
		// Un sábado sin festivo no avisa (el fin de semana ya está cerrada).
		expect(run(tomorrowRule, {}, emptyLog(), Date.parse('2026-10-16T19:00:00Z')).ids).toEqual([]);
	});

	it('c) cambio de hora: el viernes anterior al último domingo de marzo y de octubre', () => {
		expect([lastSunday(2026, 3), lastSunday(2026, 10), lastSunday(2027, 3)]).toEqual([
			'2026-03-29',
			'2026-10-25',
			'2027-03-28'
		]);
		const oct = run(dstRule, {}, emptyLog(), Date.parse('2026-10-23T08:00:00Z')); // viernes 23, 10:00 CEST
		expect(oct.ids).toEqual(['dst:2026-10-25']);
		expect(oct.alerts[0].title).toBe('Cambio de hora este domingo: se atrasa una hora');
		expect(oct.alerts[0].body).toBe(
			'La madrugada del domingo 25 de octubre, a las 3:00 serán las 2:00 (una hora más de sueño).'
		);
		const mar = run(dstRule, {}, emptyLog(), Date.parse('2027-03-26T12:00:00Z'));
		expect(mar.alerts[0].title).toBe('Cambio de hora este domingo: se adelanta una hora');
		expect(run(dstRule, {}, emptyLog(), Date.parse('2026-10-23T07:59:00Z')).ids).toEqual([]); // 9:59
		expect(run(dstRule, {}, emptyLog(), Date.parse('2026-10-22T12:00:00Z')).ids).toEqual([]); // jueves
		expect(run(dstRule, {}, emptyLog(), Date.parse('2026-10-16T12:00:00Z')).ids).toEqual([]); // otro viernes
	});

	it('los resúmenes de las 8:05 y las 22:15 llevan la línea de vida diaria: diésel, luz de hoy y festivo', () => {
		const d: Inputs = {
			fuelEs: fuelEs(days(14, (i) => (i === 13 ? 1.412 : 1.424))),
			power: { pvpc: pvpcDay('2026-10-12', (h) => (h === 3 ? 50 : 100)), spot: [], history: [] },
			holidays: { items: [{ date: '2026-10-12', name: 'Fiesta Nacional de España', scope: 'ES' }] }
		};
		const morning = run(morningRule, d, emptyLog(), Date.parse('2026-10-12T06:05:00Z')).alerts[0].body;
		expect(morning).toContain('- Diésel: 1,412 €/L');
		expect(morning).toContain('- Luz hoy: 0,098 €/kWh de media; la hora más barata, las 3 h (0,050 €/kWh)');
		expect(morning).toContain('- Hoy es festivo en España: Fiesta Nacional de España');
		expect(morning).not.toContain('- Festivo en España'); // no se repite en «Hoy»
		const evening = run(eveningRule, d, emptyLog(), Date.parse('2026-10-12T20:15:00Z')).alerts[0].body;
		expect(evening).toContain('**Vida diaria**');
		expect(evening).toContain('- Luz hoy: 0,098 €/kWh');
		expect(evening).toContain('- Hoy es festivo en España: Fiesta Nacional de España');
	});
});

describe('P4: resúmenes', () => {
	const d: Inputs = {
		imp: {
			current: [
				{ k: 'a', title: 'Tema A', sources: ['x', 'y'], score: 9 },
				{ k: 'b', title: 'Tema B', sources: ['x'], score: 5 }
			],
			days: [{ date: '2026-10-28', items: [{ k: 'c', title: 'Tema del día', sources: ['x', 'y', 'z'], score: 12 }] }]
		},
		holidays: { items: [{ date: '2026-10-29', name: 'Prueba', scope: 'ES' }] },
		crypto: { coins: [{ id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', usd: 1, eur: 1, change24h: 1.2, marketCap: 0 }] }
	};

	it('«Buenos días» desde las 8:05 de Madrid, con IMP, la agenda de hoy y mercados, en Markdown', () => {
		const at = Date.parse('2026-10-28T07:05:00Z'); // 08:05 CET: el día de la Fed
		const { alerts } = run(morningRule, d, emptyLog(), at);
		expect(alerts.map((a) => a.id)).toEqual(['morning:2026-10-28']);
		expect(alerts[0].markdown).toBe(true);
		expect(alerts[0].body).toContain('1. Tema A (2 medios)');
		expect(alerts[0].body).toContain('- Fed: decisión de tipos a las 19:00');
		expect(alerts[0].body).toContain('BTC +1,2 %');
		expect(run(morningRule, d, emptyLog(), at - 60_000).ids).toEqual([]);
	});

	it('«Cierre» desde las 22:15 de Madrid, con lo del día y la agenda de mañana', () => {
		const at = Date.parse('2026-10-28T21:15:00Z'); // 22:15 CET
		const { alerts } = run(eveningRule, d, emptyLog(), at);
		expect(alerts.map((a) => a.id)).toEqual(['evening:2026-10-28']);
		expect(alerts[0].body).toContain('1. Tema del día (3 medios)');
		expect(alerts[0].body).toContain('- BCE: decisión de tipos a las 14:15');
		expect(alerts[0].body).toContain('- Festivo en España: Prueba');
		expect(run(eveningRule, d, emptyLog(), at - 60_000).ids).toEqual([]);
	});

	it('cambio de hora del 25 oct 2026: las 8:05 y las 22:15 de Madrid son otra hora UTC', () => {
		// Sábado 24 (CEST, UTC+2) y domingo 25 (CET, UTC+1).
		expect(run(morningRule, {}, emptyLog(), Date.parse('2026-10-24T06:05:00Z')).ids).toEqual(['morning:2026-10-24']);
		expect(run(morningRule, {}, emptyLog(), Date.parse('2026-10-25T06:05:00Z')).ids).toEqual([]); // 07:05 CET
		expect(run(morningRule, {}, emptyLog(), Date.parse('2026-10-25T07:05:00Z')).ids).toEqual(['morning:2026-10-25']);
		expect(run(eveningRule, {}, emptyLog(), Date.parse('2026-10-24T20:15:00Z')).ids).toEqual(['evening:2026-10-24']);
		expect(run(eveningRule, {}, emptyLog(), Date.parse('2026-10-25T20:15:00Z')).ids).toEqual([]); // 21:15 CET
		expect(run(eveningRule, {}, emptyLog(), Date.parse('2026-10-25T21:15:00Z')).ids).toEqual(['evening:2026-10-25']);
	});
});

describe('P2: euríbor e IPC', () => {
	// Forma real de ecb.json: serie mensual «euribor-12m» con periodos «2026-09».
	const ecb = series('euribor-12m', [
		['2025-09', 3.14],
		['2026-07', 2.3],
		['2026-08', 2.26],
		['2026-09', 2.21]
	]);

	it('cuota de la hipoteca tipo: 150.000 € a 25 años con euríbor + 0,8 (sistema francés)', () => {
		// 3,01 % anual: 150.000 · i / (1 − (1 + i)^−300), con i = 0,0301 / 12.
		expect(Math.round(typicalPayment(2.21)!)).toBe(712);
		expect(Math.round(typicalPayment(3.14)!)).toBe(787);
	});

	it('euríbor nuevo: valor, frente al mes anterior y a hace un año, y la cuota de la hipoteca tipo', () => {
		const { alerts } = run(macroRule, { ecb }, withLast({ 'macro:euribor-12m': '2026-08' }));
		expect(alerts.map((a) => a.id)).toEqual(['macro:euribor-12m:2026-09']);
		expect(alerts[0].title).toBe('Euríbor a 12 meses: 2,21 %');
		expect(alerts[0].body).toBe(
			'Euríbor de septiembre: 2,21 % (−0,05 frente a agosto · −0,93 frente a hace un año). ' +
				'Hipoteca tipo de 150.000 € a 25 años: 712 €/mes (−75 € frente a hace un año).'
		);
		// La primera vez solo se apunta; el mismo mes no se repite.
		expect(run(macroRule, { ecb }).ids).toEqual([]);
		expect(run(macroRule, { ecb }, withLast({ 'macro:euribor-12m': '2026-09' })).ids).toEqual([]);
	});

	it('euríbor sin el dato de hace un año: sin esa comparación', () => {
		const short = series('euribor-12m', [
			['2026-08', 2.26],
			['2026-09', 2.21]
		]);
		expect(euriborText(short.series[0])).toBe(
			'Euríbor de septiembre: 2,21 % (−0,05 frente a agosto). Hipoteca tipo de 150.000 € a 25 años: 712 €/mes.'
		);
	});

	it('IPC de España: el adelantado y el definitivo del mismo mes no se repiten (el id es el del periodo)', () => {
		// Adelantado de septiembre (fin de mes) y definitivo (mediados del siguiente), con otro valor.
		const flash = { ine: series('ipc-es', [['2026-08', 2.7], ['2026-09', 2.9]]) };
		const final = { ine: series('ipc-es', [['2026-08', 2.7], ['2026-09', 3.0]]) };
		const first = run(macroRule, flash, withLast({ 'macro:ipc-es': '2026-08' }));
		expect(first.ids).toEqual(['macro:ipc-es:2026-09']);
		const log = withLast({ 'macro:ipc-es': '2026-08' });
		first.alerts[0].commit!(log);
		log.entries.push({ k: first.ids[0], t: '2026-09-30T09:00Z', s: 'sent', p: 2 });
		// El definitivo: mismo periodo, otro valor. Ni la regla lo da ni, aunque lo diera, el id sería nuevo.
		expect(run(macroRule, final, log).ids).toEqual([]);
		expect(run(macroRule, final, withLast({ 'macro:ipc-es': '2026-08' })).ids).toEqual(first.ids);
	});
});

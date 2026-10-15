// Avisos con datos que ya se descargan: inventarios de la EIA, VIX, subastas del Tesoro y récords macro.
import { describe, expect, it } from 'vitest';
import {
	auctionRule,
	eiaRule,
	emptyLog,
	macroRule,
	madrid,
	recordNote,
	vixRule,
	type Inputs,
	type NotifyLog,
	type Rule,
	type RuleContext
} from '../alerts/rules.ts';
import type { Series } from '../../src/lib/types.ts';

// 14 oct 2026 (miércoles), 18:00 en Madrid.
const NOW = Date.parse('2026-10-14T16:00:00Z');

function run(rule: Rule['run'], d: Inputs, log: NotifyLog = emptyLog(), now = NOW) {
	const ctx: RuleContext = { now, today: madrid(now).date, log, update: () => {} };
	const alerts = rule(d, ctx);
	return { alerts, ids: alerts.map((a) => a.id) };
}

// Forma de eia.json (EiaData de src/lib/eia.ts), en millones de barriles.
const stock = (id: string, label: string, a: number, b: number, t = '2026-10-09') => ({
	id,
	label,
	points: [
		{ t: '2026-10-02', v: a },
		{ t, v: b }
	],
	avg5: null
});

describe('inventarios de la EIA', () => {
	it('cada semana nueva: cambio de crudo, gasolina, destilados y Cushing (no la reserva estratégica)', () => {
		const eia = {
			stocks: [
				stock('WCESTUS1', 'Crudo, sin la reserva', 420, 422.1),
				stock('WGTSTUS1', 'Gasolina', 220, 219),
				stock('WDISTUS1', 'Destilados', 115, 115.3),
				stock('WCSSTUS1', 'Reserva estratégica', 400, 401)
			]
		};
		const { alerts } = run(eiaRule, { eia });
		expect(alerts.map((a) => a.id)).toEqual(['eia:2026-10-09']);
		expect(alerts[0].title).toBe('Inventarios de petróleo: Crudo, sin la reserva +2,1 M bbl');
		expect(alerts[0].body).toBe(
			'Crudo, sin la reserva +2,1 · Gasolina −1,0 · Destilados +0,3 millones de barriles en la semana del 9 de octubre de 2026 (EIA).'
		);
		// Un dato de hace más de 8 días ya no avisa.
		expect(run(eiaRule, { eia: { stocks: [stock('WCESTUS1', 'Crudo', 1, 2, '2026-10-02')] } }).ids).toEqual([]);
	});
});

describe('VIX', () => {
	const vix = (rows: [string, number, number][]) => ({
		tenors: ['9D', '1M', '3M'],
		days: rows.map(([date, v1, v3]) => ({ date, values: [null, v1, v3] }))
	});

	it('sube un 15 % o más en el día', () => {
		const { alerts } = run(vixRule, { vix: vix([['2026-10-12', 16, 19], ['2026-10-13', 18.6, 19.5]]) });
		expect(alerts.map((a) => a.id)).toEqual(['vix:2026-10-13']);
		expect(alerts[0].title).toBe('VIX +16 %: 18,6');
		expect(run(vixRule, { vix: vix([['2026-10-12', 16, 19], ['2026-10-13', 18, 19]]) }).ids).toEqual([]);
	});

	it('la curva se invierte: solo el día en que pasa', () => {
		const flip = run(vixRule, { vix: vix([['2026-10-12', 19, 20], ['2026-10-13', 21, 20.5]]) });
		expect(flip.ids).toEqual(['vix-inv:2026-10-13']);
		expect(run(vixRule, { vix: vix([['2026-10-12', 21, 20], ['2026-10-13', 22, 21]]) }).ids).toEqual([]);
	});
});

describe('subastas del Tesoro', () => {
	// Forma de auctions.json (AuctionsData de src/lib/types.ts).
	const auction = (date: string, term: string, bidToCover: number, avgBidToCover: number | null) => ({
		date,
		term,
		kind: 'Note',
		reopening: false,
		offering: 4.2e10,
		highYield: 4.125,
		bidToCover,
		indirectPct: 61.5,
		avgBidToCover
	});

	it('floja si el bid-to-cover queda 0,15 o más por debajo de la media, y es de los últimos 3 días', () => {
		const auctions = {
			upcoming: [],
			recent: [
				auction('2026-10-14', '10-Year', 2.35, 2.55),
				auction('2026-10-13', '3-Year', 2.6, 2.7),
				auction('2026-10-08', '30-Year', 2.1, 2.4),
				auction('2026-10-14', '20-Year', 2.2, null)
			]
		};
		const { alerts } = run(auctionRule, { auctions });
		expect(alerts.map((a) => a.id)).toEqual(['auction:2026-10-14:10-Year']);
		expect(alerts[0].title).toBe('Subasta floja: 10-Year del Tesoro');
		expect(alerts[0].body).toBe('Bid-to-cover 2,35, frente a 2,55 de media · rentabilidad 4,125 % · extranjeros (indirectos) 61,5 %.');
	});
});

describe('datos macro', () => {
	const points = (vals: [string, number][]) => vals.map(([t, v]) => ({ t, v }));

	it('récord: máximo o mínimo de al menos 2 años de historial', () => {
		const s = (vals: [string, number][]) => ({ id: 'x', label: '', unit: '%', geo: 'EA', points: points(vals) }) as Series;
		expect(recordNote(s([['2023-09', 7], ['2024-09', 6.5], ['2025-09', 6.4], ['2026-09', 6.2]]))).toBe('mínimo de 3 años');
		expect(recordNote(s([['2024-09', 1], ['2025-09', 2], ['2026-09', 3]]))).toBe('máximo de 2 años');
		expect(recordNote(s([['2025-09', 1], ['2026-08', 2], ['2026-09', 3]]))).toBeNull();
		expect(recordNote(s([['2024-09', 1], ['2025-09', 4], ['2026-09', 3]]))).toBeNull();
	});

	it('las series nuevas: ESI en puntos, peticiones de paro semanales en miles y el récord en el título', () => {
		const log: NotifyLog = { ...emptyLog(), last: { 'macro:esi-ea': '2026-08', 'macro:claims-us': '2026-10-03' } };
		const d = {
			eurostat: {
				series: [
					{ id: 'esi-ea', label: '', unit: 'índice', geo: 'EA', points: points([['2024-09', 96], ['2026-08', 97.9], ['2026-09', 98.3]]) }
				]
			},
			fred: {
				series: [{ id: 'claims-us', label: '', unit: 'miles', geo: 'US', points: points([['2026-10-03', 225], ['2026-10-10', 241]]) }]
			}
		} as Inputs;
		const { alerts } = run(macroRule, d, log);
		expect(alerts.map((a) => [a.title, a.body])).toEqual([
			[
				'Peticiones de paro en EE. UU.: 241 miles',
				'Semana del 10 de octubre de 2026 (Departamento de Trabajo vía FRED). Anterior: 225 miles (+16).'
			],
			[
				'Sentimiento económico de la zona euro: 98,3 puntos · máximo de 2 años',
				'septiembre de 2026 (Comisión Europea vía Eurostat). Anterior: 97,9 puntos (+0,4).'
			]
		]);
	});
});

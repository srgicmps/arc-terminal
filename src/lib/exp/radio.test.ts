import { describe, expect, it } from 'vitest';
import type { Earnings, Quote, ReleaseEvent } from '../types.ts';
import { buildProgram, moveOf, personalSegment } from './radio.ts';

const NOW = Date.parse('2026-10-15T07:30:00Z');

describe('radio', () => {
	it('dice los movimientos: puntos básicos en los tipos, % en lo demás', () => {
		expect(moveOf('rate', 4.1, 4.15).said).toBe('sube 5 puntos básicos');
		expect(moveOf('rate', 4.1, 4.09)).toMatchObject({ said: 'baja 1 punto básico', shown: '−1 pb', tone: 'down' });
		expect(moveOf('price', 100, 98.8)).toMatchObject({ said: 'baja un 1,2 %', tone: 'down' });
		expect(moveOf('fx', 1.1, 1.1).said).toBe('sin apenas cambios');
	});

	it('arma el programa con lo que hay y salta los bloques sin datos', () => {
		const release: ReleaseEvent = { date: '2026-10-15T12:30:00Z', allDay: false, title: 'CPI', source: 'BLS', topic: null };
		const p = buildProgram({
			now: NOW,
			headlines: [
				{ title: 'A', titleEs: 'Uno', sources: ['x', 'y'] },
				{ title: 'English only', lang: 'en', sources: ['x'] }
			],
			series: {
				'uscurve-10A': [{ t: '1', v: 4.1 }, { t: '2', v: 4.15 }],
				'ipc-es': [{ t: '2026-08', v: 2.7 }, { t: '2026-09', v: 2.9 }]
			},
			releases: [release, { ...release, date: '2026-10-16T12:30:00Z' }]
		});
		expect(p.map((s) => s.id)).toEqual(['intro', 'imp', 'markets', 'eco', 'agenda']);
		expect(p[0].lines[0].text).toMatch(/^Buenos días\. Es jueves, 15 de octubre/);
		expect(p[1].lines).toEqual([
			{ text: 'Primero: Uno.', lang: 'es' },
			{ text: 'English only.', lang: 'en' }
		]);
		expect(p[2].lines[1].text).toBe('El bono de Estados Unidos a 10 años, 4,15 %, sube 5 puntos básicos.');
		expect(p[3].lines[0].text).toBe('La inflación en España sube al 2,9 %.');
		expect(p[4].lines[0].text).toBe('Hoy se publica: CPI, a las 14:30.');
	});

	it('tus valores: cómo van y sus resultados próximos', () => {
		const q = { symbol: 'NVDA', price: 180, changePct: 2.04, change: 1, prevClose: 1, time: null } as Quote;
		const e = { date: '2026-10-16', symbol: 'AAPL', hour: 'amc' } as Earnings;
		const s = personalSegment(['NVDA', 'AAPL', 'TSLA'], [q], [e], NOW)!;
		expect(s.lines.map((l) => l.text)).toEqual(['Tus valores.', 'NVDA, sube un 2,0 %.', expect.stringMatching(/^AAPL presenta resultados mañana/)]);
		expect(s.items[0].tone).toBe('up');
		expect(personalSegment(['TSLA'], [q], [], NOW)).toBeNull();
	});
});

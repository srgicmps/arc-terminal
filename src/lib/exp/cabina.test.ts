import { describe, expect, it } from 'vitest';
import { arcPath, GAUGES, levelOf, needleAngle, zoneArcs } from './cabina.ts';

const vix = GAUGES.find((g) => g.id === 'vix')!;

describe('Cabina', () => {
	it('pone la aguja entre −90 y 90 grados, sin salirse', () => {
		expect(needleAngle(vix, 10)).toBe(-90);
		expect(needleAngle(vix, 30)).toBe(0);
		expect(needleAngle(vix, 80)).toBe(90);
	});

	it('da el nivel de cada zona', () => {
		expect(levelOf(vix, 15)).toBe('calm');
		expect(levelOf(vix, 25)).toBe('watch');
		expect(levelOf(vix, 60)).toBe('stress');
		const ipc = GAUGES.find((g) => g.id === 'ipc')!;
		expect(levelOf(ipc, 0)).toBe('watch');
		expect(levelOf(ipc, 2)).toBe('calm');
	});

	it('las zonas cubren la esfera entera, de 0 a 1', () => {
		for (const g of GAUGES) {
			const arcs = zoneArcs(g);
			expect(arcs[0].from).toBe(0);
			expect(arcs.at(-1)!.to).toBe(1);
			for (let i = 1; i < arcs.length; i++) expect(arcs[i].from).toBe(arcs[i - 1].to);
		}
	});

	it('dibuja el arco de izquierda a derecha', () => {
		expect(arcPath(0, 1, 10)).toBe('M -10.00 0.00 A 10 10 0 0 1 10.00 0.00');
	});
});

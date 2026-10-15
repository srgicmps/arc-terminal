import { describe, expect, it } from 'vitest';
import { pctPhrase, riskPhrase, summaryLine, trend } from './summary.ts';
import type { Light } from './risk-lights.ts';

const pts = (...v: number[]) => v.map((x, i) => ({ t: `2026-0${i + 1}`, v: x }));
const light = (level: Light['level']): Light => ({ id: level, label: '', name: '', value: '', date: '', level, rule: '' });

describe('resumen en una línea', () => {
	it('dice si sube, baja o se queda, con los decimales que se ven', () => {
		expect(trend('Inflación euro', pts(2.2, 2.1))).toBe('Inflación euro baja al 2,1 %');
		expect(trend('Paro EE. UU.', pts(4.2, 4.3))).toBe('Paro EE. UU. sube al 4,3 %');
		expect(trend('BCE', pts(2, 2.001), 2)).toBe('BCE sin cambios en el 2,00 %');
		expect(trend('EUR/USD', pts(1.08, 1.09), 4, '')).toBe('EUR/USD sube a 1,0900');
		expect(trend('X', [])).toBeNull();
	});

	it('resume el riesgo y el semáforo', () => {
		expect(riskPhrase(5, [light('calm'), light('watch'), light('watch')])).toBe('Riesgo: neutral · 2 de 3 en vigilancia');
		expect(riskPhrase(-50, [light('stress'), light('calm')])).toBe('Riesgo: risk-off fuerte · 1 de 2 en tensión');
		expect(riskPhrase(null, [])).toBeNull();
	});

	it('junta solo lo que hay', () => {
		expect(summaryLine(['a', null, pctPhrase('bitcoin', -2.04, 'en 24 h'), pctPhrase('x', null, '')])).toBe('a · bitcoin −2,0 % en 24 h');
	});
});

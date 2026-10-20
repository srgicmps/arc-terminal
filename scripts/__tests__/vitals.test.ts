// Core Web Vitals de laboratorio (scripts/vitals.ts): mediana, presupuestos, avisos y la tabla del resumen.
import { describe, expect, it } from 'vitest';
import { budgetFor, GOOD, median, overBudget, sessionCls, summaryTable, warnings, type Row } from '../vitals.ts';

const row = (path: string, profile: string, lcp: number, cls: number, extra: Partial<Row['vitals']> = {}): Row => ({
	path,
	profile,
	vitals: { lcp, cls, tbt: 1200, selfKB: 297, fonts: true, ...extra },
	budget: budgetFor(path)
});

describe('vitals', () => {
	it('mediana con un número impar y par de valores, sin tocar la lista', () => {
		const odd = [2100, 1700, 1900];
		expect(median(odd)).toBe(1900);
		expect(odd).toEqual([2100, 1700, 1900]);
		expect(median([4, 1, 3, 2])).toBe(2.5);
		expect(median([0.1])).toBe(0.1);
		expect(median([])).toBeNaN();
	});

	it('CLS como web.dev: la peor ventana de sesión, no la suma de todos los saltos', () => {
		expect(sessionCls([])).toBe(0);
		expect(sessionCls([{ t: 300, v: 0.04 }])).toBe(0.04);
		// A menos de 1 s, la misma ventana: se suman.
		expect(sessionCls([{ t: 0, v: 0.05 }, { t: 900, v: 0.04 }])).toBeCloseTo(0.09);
		// A 1 s o más, ventanas distintas: cuenta la mayor, no la suma.
		expect(sessionCls([{ t: 0, v: 0.05 }, { t: 1000, v: 0.04 }])).toBe(0.05);
		expect(sessionCls([{ t: 2500, v: 0.04 }, { t: 0, v: 0.03 }, { t: 4000, v: 0.02 }])).toBe(0.04);
		// La ventana dura 5 s como mucho: un salto cada 0,9 s (siete en 5,4 s) no va todo junto.
		const steady = [0, 900, 1800, 2700, 3600, 4500, 5400].map((t) => ({ t, v: 0.01 }));
		expect(sessionCls(steady)).toBeCloseTo(0.06);
		// La segunda ventana gana si suma más.
		expect(sessionCls([...steady.slice(0, 6), { t: 5400, v: 0.08 }])).toBeCloseTo(0.08);
	});

	it('avisa solo por encima del presupuesto: igual no cuenta', () => {
		const b = { lcp: 2500, cls: 0.1 };
		expect(overBudget({ lcp: 2501, cls: 0.05 }, b)).toEqual(['LCP']);
		expect(overBudget({ lcp: 2500, cls: 0.1 }, b)).toEqual([]);
		expect(overBudget({ lcp: 1800, cls: 0.02 }, b)).toEqual([]);
		expect(overBudget({ lcp: 3000, cls: 0.2 }, b)).toEqual(['LCP', 'CLS']);
	});

	it('cada vista tiene su presupuesto y las que no salen usan «bueno» (2,5 s y 0,1)', () => {
		expect(GOOD).toEqual({ lcp: 2500, cls: 0.1 });
		expect(budgetFor('/fuel')).toEqual(GOOD);
		expect(budgetFor('/eco')).toEqual(GOOD);
		// Ningún presupuesto por debajo de «bueno» (sería avisar de lo que ya está bien).
		for (const path of ['/', '/geo', '/ws', '/fuel']) {
			expect(budgetFor(path).lcp).toBeGreaterThanOrEqual(GOOD.lcp);
			expect(budgetFor(path).cls).toBeGreaterThanOrEqual(GOOD.cls);
		}
	});

	it('un aviso por vista y perfil que se pasa, con qué es el LCP y si faltó la letra', () => {
		const rows = [
			row('/', 'Terminal', 1800, 0.059),
			row('/fuel', 'Sencillo', 2700, 0.13, { el: 'p.pnote «El historial de la media…»', fonts: false })
		];
		expect(warnings(rows)).toEqual([
			'FUEL (Sencillo): LCP 2,7 s (presupuesto 2,5 s) y CLS 0,130 (presupuesto 0,100) en el móvil con la CPU 4x y 4G lenta; el LCP es p.pnote «El historial de la media…»; Google Fonts no cargó en esta pasada y puede subir el LCP'
		]);
		expect(warnings([row('/ws', 'Terminal', 2000, 0.03)])).toEqual([]);
	});

	it('tabla en Markdown: una fila por vista y perfil, ⚠ en lo que se pasa y nota si faltó la letra', () => {
		const table = summaryTable([row('/', 'Terminal', 1800, 0.059), row('/ws', 'Sencillo', 2800, 0.0, { fonts: false })], 3);
		const lines = table.split('\n');
		expect(lines[0]).toBe('### Core Web Vitals en el móvil (laboratorio)');
		expect(table).toContain('mediana de 3 cargas en frío');
		expect(lines).toContain('| Vista | Perfil | LCP | CLS | TBT aprox. | KB propios | Presupuesto (LCP · CLS) |');
		expect(lines).toContain('| TOP | Terminal | 1,8 s | 0,059 | 1,2 s | 297 | 2,5 s · 0,1 |');
		expect(lines).toContain('| WS | Sencillo | 2,8 s ⚠ ¹ | 0,000 | 1,2 s | 297 | 2,5 s · 0,1 |');
		expect(table).toContain('¹ Google Fonts no cargó');
		// Las filas de datos tienen tantas columnas como la cabecera.
		const cols = (l: string) => l.split('|').length;
		for (const l of lines.filter((l) => l.startsWith('| ') && !l.startsWith('| Vista'))) expect(cols(l)).toBe(cols(lines.find((l) => l.startsWith('| Vista'))!));
		expect(summaryTable([], 1)).toContain('mediana de 1 carga en frío');
		expect(summaryTable([row('/', 'Terminal', 1800, 0.059)])).not.toContain('¹ Google Fonts');
		expect(table).not.toContain('+15 %');
	});

	it('una vista con presupuesto propio (trinquete) lo enseña y la leyenda lo explica', () => {
		const geo = { ...row('/geo', 'Terminal', 3200, 0.02), budget: { lcp: 3500, cls: 0.1 } };
		const table = summaryTable([geo]);
		expect(table).toContain('| GEO | Terminal | 3,2 s | 0,020 | 1,2 s | 297 | 3,5 s · 0,1 |');
		expect(table).toContain('medida de partida +15 %');
		expect(warnings([geo])).toEqual([]);
		expect(warnings([{ ...geo, vitals: { ...geo.vitals, lcp: 3600 } }])[0]).toMatch(/^GEO \(Terminal\): LCP 3,6 s \(presupuesto 3,5 s\)/);
	});
});

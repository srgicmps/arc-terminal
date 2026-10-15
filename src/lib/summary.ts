// Resumen en una línea arriba de cada vista (lote 26-B, idea 11): frases cortas hechas con los datos, sin IA,
// pensadas para leer en el móvil antes de bajar. Cada vista junta sus piezas con summaryLine(); lo que falte
// (fuente caída, sin clave) simplemente no sale. Se pinta con la prop `summary` de ViewHeader.
import type { Point } from './types.ts';
import { riskLabel } from './risk.ts';
import type { Light } from './risk-lights.ts';

const nf = (v: number, d: number) =>
	v.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d }).replace('-', '−');

/** Junta las piezas que haya con « · ». */
export const summaryLine = (parts: (string | null | undefined | false)[]) => parts.filter(Boolean).join(' · ');

/** «Inflación euro baja al 2,1 %», «paro EE. UU. sube al 4,3 %», «BCE sin cambios en el 2,00 %». */
export function trend(label: string, points: readonly Point[] | undefined, decimals = 1, unit = '%'): string | null {
	const last = points?.at(-1);
	if (!last) return null;
	const prev = points!.at(-2);
	const value = unit === '%' ? `${nf(last.v, decimals)} %` : `${nf(last.v, decimals)}${unit}`;
	const pct = unit === '%';
	// Se compara con lo que se ve: con los decimales que se escriben.
	const diff = prev ? Number(nf(last.v - prev.v, decimals).replace(',', '.').replace('−', '-')) : 0;
	if (!prev || !diff) return `${label} ${prev ? 'sin cambios en' : 'en'} ${pct ? 'el ' : ''}${value}`;
	return `${label} ${diff > 0 ? 'sube' : 'baja'} ${pct ? 'al' : 'a'} ${value}`;
}

/** «Riesgo: neutral · 2 de 8 en vigilancia» (con el semáforo de TOP, si lo hay). */
export function riskPhrase(score: number | null, lights: Light[] = []): string | null {
	const watch = lights.filter((l) => l.level === 'watch').length;
	const stress = lights.filter((l) => l.level === 'stress').length;
	const lightsText = lights.length
		? stress
			? `${stress} de ${lights.length} en tensión`
			: watch
				? `${watch} de ${lights.length} en vigilancia`
				: 'semáforo en calma'
		: null;
	if (score === null && !lightsText) return null;
	return summaryLine([score !== null && `Riesgo: ${riskLabel(score).toLowerCase()}`, lightsText]);
}

/** «bitcoin +2,1 % en 24 h». */
export const pctPhrase = (label: string, pct: number | null | undefined, span: string) =>
	pct == null ? null : `${label} ${pct > 0 ? '+' : ''}${nf(pct, 1)} % ${span}`;

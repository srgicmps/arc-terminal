// VIX y su curva: índices de volatilidad de Cboe sobre el S&P 500 a 9 días, 30 días (el VIX), 3, 6 y 12 meses.
// https://www.cboe.com/tradable_products/vix/ · CSV diarios públicos en cdn.cboe.com, sin clave; se cita a Cboe.
// Sin límite publicado: cinco CSV pequeños cada 3 h. Cada CSV trae toda la historia (DATE,OPEN,HIGH,LOW,CLOSE,
// fechas MM/DD/AAAA); se guarda el cierre de los últimos días, como una curva más (YieldCurveData).
import type { YieldCurveData } from '../../src/lib/types.ts';
import { getText, num, type Source } from '../lib.ts';

const BASE = 'https://cdn.cboe.com/api/global/us_indices/daily_prices';

/** Índice de Cboe y su plazo en la curva. */
export const INDICES: [string, string][] = [
	['VIX9D', '9D'],
	['VIX', '1M'],
	['VIX3M', '3M'],
	['VIX6M', '6M'],
	['VIX1Y', '1A']
];

/** Días hábiles que se guardan: algo más de un mes, para la curva de hace un mes. */
const KEEP = 30;

/** «10/13/2026» → «2026-10-13». */
export function cboeDate(value: string): string | null {
	const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
	return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}

/** Cierre de cada día de un CSV de Cboe. */
export function parseCloses(csv: string): Map<string, number> {
	const lines = csv.trim().split(/\r?\n/).map((l) => l.split(','));
	const col = lines[0]?.findIndex((h) => h.trim().toUpperCase() === 'CLOSE') ?? -1;
	const closes = new Map<string, number>();
	if (col < 0) return closes;
	for (const cells of lines.slice(1)) {
		const date = cboeDate(cells[0] ?? '');
		const v = num(cells[col]);
		if (date && v !== null) closes.set(date, v);
	}
	return closes;
}

/**
 * Junta los índices por fecha: los días en que hay VIX y al menos 3 plazos (en algunos festivos de EE. UU.,
 * como el Labor Day, Cboe da el VIX y nada más), y los últimos KEEP.
 */
export function toCurve(byIndex: Map<string, number>[]): YieldCurveData {
	const vix = byIndex[INDICES.findIndex(([i]) => i === 'VIX')];
	const days = [...(vix?.keys() ?? [])]
		.sort()
		.map((date) => ({ date, values: byIndex.map((m) => m.get(date) ?? null) }))
		.filter((d) => d.values.filter((v) => v !== null).length >= 3);
	return { tenors: INDICES.map(([, tenor]) => tenor), days: days.slice(-KEEP) };
}

export const vix: Source<YieldCurveData> = {
	name: 'vix',
	label: 'VIX y su curva · Cboe',
	maxAgeMinutes: 175,
	async fetch() {
		// Si falla un plazo que no es el VIX, la curva sale con ese hueco.
		const byIndex = await Promise.all(
			INDICES.map(([index]) =>
				getText(`${BASE}/${index}_History.csv`).then(parseCloses, (error) => {
					if (index === 'VIX') throw error;
					return new Map<string, number>();
				})
			)
		);
		const curve = toCurve(byIndex);
		if (!curve.days.length) throw new Error('Cboe no trae cierres del VIX');
		return curve;
	}
};

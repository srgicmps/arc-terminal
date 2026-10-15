// Tipos de referencia del mercado monetario de EE. UU.: Fed de Nueva York (Markets Data API, JSON público y sin
// clave). https://markets.newyorkfed.org/static/docs/markets-api.html
// - /api/rates/secured/{sofr|tgcr|bgcr}/last/N.json y /api/rates/unsecured/{effr|obfr}/last/N.json
//   → { refRates: [{ effectiveDate: "2026-10-14", type: "SOFR", percentRate: 4.31, volumeInBillions: 2512 }, …] },
//   del más reciente al más antiguo. Para BTMM: el tipo y su volumen.
import type { Series, SeriesData } from '../../src/lib/types.ts';
import { getJson, num, type Source } from '../lib.ts';

const API = 'https://markets.newyorkfed.org/api/rates';
const LAST = 90;

const RATES: { path: string; id: string; label: string }[] = [
	{ path: 'secured/sofr', id: 'nyfed-sofr', label: 'SOFR (repo con garantía del Tesoro)' },
	{ path: 'secured/tgcr', id: 'nyfed-tgcr', label: 'TGCR (repo tripartito)' },
	{ path: 'secured/bgcr', id: 'nyfed-bgcr', label: 'BGCR (repo general)' },
	{ path: 'unsecured/effr', id: 'nyfed-effr', label: 'Fondos federales efectivos (EFFR)' },
	{ path: 'unsecured/obfr', id: 'nyfed-obfr', label: 'Financiación a un día (OBFR)' }
];

/** Lee la respuesta de la API: el tipo y el volumen por día, del más antiguo al más reciente. */
export function parseRefRates(body: unknown): { t: string; v: number; vol: number | null }[] {
	const rows = (body as { refRates?: unknown })?.refRates;
	if (!Array.isArray(rows)) return [];
	const out = new Map<string, { t: string; v: number; vol: number | null }>();
	for (const r of rows as Record<string, unknown>[]) {
		const t = typeof r?.effectiveDate === 'string' ? r.effectiveDate.slice(0, 10) : '';
		const v = num(r?.percentRate);
		if (/^\d{4}-\d{2}-\d{2}$/.test(t) && v !== null) out.set(t, { t, v, vol: num(r.volumeInBillions) });
	}
	return [...out.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export const nyfed: Source<SeriesData> = {
	name: 'nyfed',
	label: 'Fed de Nueva York · SOFR, EFFR, OBFR, TGCR y BGCR',
	maxAgeMinutes: 240,
	async fetch() {
		const series: Series[] = [];
		const results = await Promise.allSettled(RATES.map((r) => getJson(`${API}/${r.path}/last/${LAST}.json`)));
		results.forEach((res, i) => {
			const r = RATES[i];
			if (res.status === 'rejected') return console.log(`  nyfed · ${r.id}: ${(res.reason as Error).message}`);
			const days = parseRefRates(res.value);
			if (!days.length) return;
			const url = 'https://www.newyorkfed.org/markets/reference-rates';
			series.push({ id: r.id, label: r.label, unit: '%', geo: 'US', points: days.map(({ t, v }) => ({ t, v })), source: 'Fed de Nueva York', url });
			const vol = days.flatMap(({ t, vol }) => (vol === null ? [] : [{ t, v: vol }]));
			if (vol.length) series.push({ id: `${r.id}-vol`, label: `${r.label.split(' (')[0]}, volumen`, unit: 'mm $', geo: 'US', points: vol, source: 'Fed de Nueva York', url });
		});
		if (!series.length) throw new Error('la Fed de Nueva York no ha devuelto ningún tipo');
		return { series };
	}
};

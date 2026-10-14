// Inseguridad alimentaria aguda por país según FEWS NET (Famine Early Warning Systems Network): personas en
// fase IPC 3 o peor (crisis, emergencia o hambruna). API pública del FEWS NET Data Warehouse, sin clave.
// https://fdw.fews.net · Datos públicos («data_usage_policy: Public»), citando a FEWS NET. Estuvo parada en
// 2025; responde de nuevo. Es lenta (unos 15 s), así que se pide una vez al día.
import type { FoodInsecurity } from '../../src/lib/types.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** Desde hace un año: con eso basta para tener el último dato de cada país. */
export const fewsUrl = (now = Date.now()) =>
	'https://fdw.fews.net/api/ipcpopulationsize/?' +
	new URLSearchParams({
		format: 'json',
		phase: '3+',
		unit_type: 'admin0',
		start_date: new Date(now - 365 * 86_400_000).toISOString().slice(0, 10),
		page_size: '2000'
	});

/** Preferencia de escenario: la situación actual antes que una proyección y que los picos del año. */
const RANK: Record<string, number> = { 'Current Situation': 0, 'Most Likely': 1, 'Projection': 1, 'Peak Needs': 2 };

/** El dato más reciente de cada país (con el mejor escenario a igualdad de fecha), de más a menos personas. */
export function parseFews(body: Raw, now = Date.now()): FoodInsecurity[] {
	const today = new Date(now).toISOString().slice(0, 10);
	const best = new Map<string, { row: FoodInsecurity; rank: number }>();
	for (const r of list<Raw>(body?.results)) {
		const code = String(r?.country_code ?? '');
		const low = num(r?.low_value);
		const high = num(r?.high_value) ?? low;
		const from = String(r?.projection_start ?? '');
		const to = String(r?.projection_end ?? '');
		if (!/^[A-Z]{2}$/.test(code) || low === null || high === null || !/^\d{4}-\d{2}-\d{2}$/.test(from)) continue;
		// Nada que empiece en el futuro: solo lo que ya se sabe o se vive ahora.
		if (from > today) continue;
		const scenario = String(r?.scenario_name ?? '');
		const rank = RANK[scenario] ?? 3;
		const row: FoodInsecurity = {
			code,
			country: plain(r?.country, 80),
			low,
			high,
			from,
			to,
			scenario,
			vsYear: r?.comparison_to_one_year_ago ? String(r.comparison_to_one_year_ago) : null
		};
		const prev = best.get(code);
		if (!prev || from > prev.row.from || (from === prev.row.from && rank < prev.rank)) best.set(code, { row, rank });
	}
	return [...best.values()].map((b) => b.row).sort((a, b) => b.high - a.high);
}

export const fewsnet: Source<FoodInsecurity[]> = {
	name: 'fewsnet',
	label: 'Inseguridad alimentaria aguda por país · FEWS NET',
	maxAgeMinutes: 24 * 60,
	async fetch() {
		const rows = parseFews(await getJson<Raw>(fewsUrl()));
		if (!rows.length) throw new Error('FEWS NET no da datos del último año');
		return rows;
	}
};

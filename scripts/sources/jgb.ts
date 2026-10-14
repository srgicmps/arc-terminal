// Ministerio de Finanzas de Japón (MOF): tipos de la deuda pública japonesa por plazo (JGB), diarios.
// https://www.mof.go.jp/english/policy/jgbs/reference/interest_rate/index.htm · Reutilización libre citando la fuente.
// Dos CSV en Shift-JIS: el del mes en curso y el histórico completo (desde 1974), que se lee para tener la
// curva de hace un año. Las fechas van en calendario japonés: «R7.10.14» es el 14-10-2025 (era Reiwa).
import type { YieldCurveData } from '../../src/lib/types.ts';
import { num, request, type Source } from '../lib.ts';

const BASE = 'https://www.mof.go.jp/jgbs/reference/interest_rate';
const CURRENT = `${BASE}/jgbcm.csv`;
const HISTORY = `${BASE}/data/jgbcm_all.csv`;

/** Plazos que se guardan (cabecera del CSV: «1年», «2年»…) y su etiqueta. */
const TENORS: [string, string][] = [
	['1年', '1A'],
	['2年', '2A'],
	['5年', '5A'],
	['10年', '10A'],
	['20年', '20A'],
	['30年', '30A'],
	['40年', '40A']
];

/** Primer año de cada era, menos uno: Reiwa 1 = 2019. */
const ERAS: Record<string, number> = { M: 1867, T: 1911, S: 1925, H: 1988, R: 2018 };

/** «R7.10.14» o «2025/10/14» → «2025-10-14». Cualquier otra cosa → null. */
export function jgbDate(value: string): string | null {
	const era = /^([MTSHR])(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/.exec(value.trim());
	const greg = /^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/.exec(value.trim());
	let y: number, m: string, d: string;
	if (era) [y, m, d] = [ERAS[era[1]] + Number(era[2]), era[3], era[4]];
	else if (greg) [y, m, d] = [Number(greg[1]), greg[2], greg[3]];
	else return null;
	return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Lee un CSV del MOF (ya pasado a texto): busca la cabecera «基準日,1年,…» y una fila por día. */
export function parseJgb(text: string): YieldCurveData['days'] {
	const lines = text.split(/\r?\n/).map((l) => l.split(',').map((c) => c.trim()));
	const h = lines.findIndex((cells) => TENORS.some(([name]) => cells.includes(name)));
	if (h < 0) return [];
	const cols = TENORS.map(([name]) => lines[h].indexOf(name));
	return lines.slice(h + 1).flatMap((cells) => {
		const date = jgbDate(cells[0] ?? '');
		if (!date) return [];
		// Los plazos sin dato llevan «-».
		const values = cols.map((c) => (c < 0 ? null : num(cells[c])));
		return values.some((v) => v !== null) ? [{ date, values }] : [];
	});
}

async function shiftJis(url: string): Promise<string> {
	const bytes = await (await request(url)).arrayBuffer();
	return new TextDecoder('shift_jis').decode(bytes);
}

/** Cuántos días de historia se guardan: algo más de un año, para la curva de hace un año. */
const KEEP_DAYS = 400;

export const jgb: Source<YieldCurveData> = {
	name: 'jgb',
	label: 'Curva de tipos de Japón · Ministerio de Finanzas (MOF)',
	// Una vez al día: el MOF la publica cada tarde (hora de Tokio).
	maxAgeMinutes: 1435,
	async fetch() {
		const [current, history] = await Promise.all([shiftJis(CURRENT), shiftJis(HISTORY)]);
		const byDate = new Map([...parseJgb(history), ...parseJgb(current)].map((d) => [d.date, d]));
		const days = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
		if (!days.length) throw new Error('curva vacía');
		const since = new Date(`${days.at(-1)!.date}T12:00:00Z`);
		since.setUTCDate(since.getUTCDate() - KEEP_DAYS);
		const from = since.toISOString().slice(0, 10);
		return { tenors: TENORS.map(([, label]) => label), days: days.filter((d) => d.date >= from) };
	}
};

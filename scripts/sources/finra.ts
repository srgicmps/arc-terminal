// Volumen en corto diario de FINRA (Reg SHO), archivo consolidado de todos los mercados NMS (CNMS): para cada
// valor de EE. UU., cuántas acciones del día se vendieron en corto y cuántas se negociaron en total.
// https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data · archivos públicos en cdn.finra.org,
// sin clave; se cita a FINRA. Un .txt por día de mercado (separado por «|», unos miles de filas), que sale por la
// tarde-noche de Nueva York; los días sin mercado responden 403/404.
// Se guardan los valores de la barra que cotizan en EE. UU. y los TOP de más volumen del último día, con los
// últimos 20 días para la media (ver src/lib/shortvol.ts). Provisional (lote 24.4, D35).
import { KEEP_DAYS, US_TICKERS, type FinraData } from '../../src/lib/shortvol.ts';
import { getText, num, type Source } from '../lib.ts';

const BASE = 'https://cdn.finra.org/equity/regsho/daily/CNMSshvol';
/** Valores con más volumen que se guardan, además de los de la barra (unos 110 KB en total). */
export const TOP = 1000;
/** Días de calendario hacia atrás que se buscan: 20 días de mercado más fines de semana y festivos. */
const LOOKBACK = 32;
/** Descargas a la vez. */
const BATCH = 5;

/** Un día del archivo de FINRA: [corto, total] por símbolo. */
export interface FinraDay {
	date: string;
	rows: Map<string, [number, number]>;
}

/** «20261013» → «2026-10-13». */
const iso = (d: string) => `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;

/** Lee el .txt de FINRA (Date|Symbol|ShortVolume|ShortExemptVolume|TotalVolume|Market). null si no trae filas. */
export function parseFinra(text: string): FinraDay | null {
	const lines = text.trim().split(/\r?\n/).map((l) => l.split('|'));
	const head = (lines[0] ?? []).map((h) => h.trim());
	const col = (name: string) => head.indexOf(name);
	const [cDate, cSym, cShort, cTotal] = [col('Date'), col('Symbol'), col('ShortVolume'), col('TotalVolume')];
	if ([cDate, cSym, cShort, cTotal].includes(-1)) return null;
	const rows = new Map<string, [number, number]>();
	let date = '';
	for (const cells of lines.slice(1)) {
		const d = cells[cDate]?.trim() ?? '';
		const sym = cells[cSym]?.trim();
		const short = num(cells[cShort]);
		const total = num(cells[cTotal]);
		if (!/^\d{8}$/.test(d) || !sym || short === null || total === null) continue;
		date ||= iso(d);
		rows.set(sym, [Math.round(short), Math.round(total)]);
	}
	return rows.size ? { date, rows } : null;
}

/** Días laborables (AAAAMMDD) de los últimos `back` días de calendario, del más reciente al más antiguo. */
export function weekdays(from: Date, back = LOOKBACK): string[] {
	const out: string[] = [];
	for (let i = 0; i < back; i++) {
		const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() - i));
		const wd = d.getUTCDay();
		if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10).replaceAll('-', ''));
	}
	return out;
}

/**
 * Junta los días descargados con la copia anterior: los últimos KEEP_DAYS días, los valores de `keep` y los TOP de
 * más volumen del último día. La proporción en corto va en décimas de % (entero).
 */
export function merge(days: FinraDay[], previous: FinraData | undefined, keep: string[] = US_TICKERS, top = TOP): FinraData {
	const byDate = new Map(days.map((d) => [d.date, d]));
	const prevDates = previous?.dates ?? [];
	const newest = [...byDate.keys()].sort().at(-1) ?? '';
	// Los días de la copia anterior más nuevos que lo descargado no se usan (no debería haberlos).
	const dates = [...new Set([...prevDates.filter((d) => d <= newest), ...byDate.keys()])].sort().slice(-KEEP_DAYS);
	const last = byDate.get(dates.at(-1) ?? '');
	// El último día tiene que venir descargado (la copia anterior no guarda los volúmenes de los días viejos).
	if (!last) throw new Error('FINRA no trae el último día');
	const biggest = [...last.rows].sort((a, b) => b[1][1] - a[1][1]).slice(0, top).map(([sym]) => sym);
	const symbols = [...new Set([...keep, ...biggest])].filter((s) => last.rows.has(s)).sort();
	const rows: FinraData['rows'] = {};
	const ratios: FinraData['ratios'] = {};
	for (const sym of symbols) {
		rows[sym] = last.rows.get(sym)!;
		const before = previous?.ratios[sym] ?? [];
		ratios[sym] = dates.map((date) => {
			const row = byDate.get(date)?.rows.get(sym);
			if (row) return row[1] > 0 ? Math.round((row[0] / row[1]) * 1000) : null;
			const i = prevDates.indexOf(date);
			return i < 0 ? null : (before[i] ?? null);
		});
	}
	return { dates, rows, ratios };
}

/**
 * Descarga el último archivo que exista (de hoy hacia atrás) y, detrás, los días que no estén ya en la copia
 * anterior, en tandas de BATCH, hasta tener KEEP_DAYS. Los días sin archivo (festivos, o el de hoy aún sin publicar)
 * se saltan.
 */
export async function download(want: string[], have: Set<string>): Promise<FinraDay[]> {
	const get = (d: string) => getText(`${BASE}${d}.txt`).then(parseFinra, () => null);
	let i = 0;
	let latest: FinraDay | null = null;
	// El último archivo, como mucho 4 días laborables atrás (un puente largo); si no hay, FINRA está caído.
	while (!latest && i < Math.min(want.length, 4)) latest = await get(want[i++]);
	if (!latest) return [];
	const days = [latest];
	const older = (date: string) => [...have].filter((h) => h < date).length;
	const rest = want.slice(i).filter((d) => !have.has(iso(d)));
	for (let j = 0; j < rest.length && days.length + older(latest.date) < KEEP_DAYS; j += BATCH) {
		const got = await Promise.all(rest.slice(j, j + BATCH).map(get));
		days.push(...got.filter((d): d is FinraDay => d !== null));
	}
	return days;
}

export const finra: Source<FinraData> = {
	name: 'finra',
	label: 'Volumen en corto diario · FINRA (Reg SHO)',
	// Un archivo al día, por la noche (hora de Madrid): basta con mirar cada 6 h.
	maxAgeMinutes: 360,
	async fetch(previous) {
		const want = weekdays(new Date());
		const days = await download(want, new Set(previous?.dates ?? []));
		if (!days.length) throw new Error('FINRA no tiene archivos de los últimos días');
		return merge(days, previous);
	}
};

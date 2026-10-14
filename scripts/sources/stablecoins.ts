// Stablecoins: DefiLlama (https://defillama.com/stablecoins), API abierta y sin clave.
// https://api-docs.defillama.com/ · Datos libres citando la fuente. Sin límite publicado: una consulta cada 3 h.
// Dos llamadas: la lista (circulación de cada una hoy, hace 1, 7 y 30 días, y precio) y el total diario de
// todas desde 2017, para la variación a 30 días y a un año.
import type { Stablecoin, StablecoinsData } from '../../src/lib/stablecoins.ts';
import { getJson, num, type Source } from '../lib.ts';

const API = 'https://stablecoins.llama.fi';
/** Cuántas se guardan. */
const TOP = 10;

type Pegged = Record<string, number | undefined> | undefined;

interface LlamaCoin {
	id: string;
	name: string;
	symbol: string;
	pegType: string;
	pegMechanism: string;
	circulating?: Pegged;
	circulatingPrevWeek?: Pegged;
	circulatingPrevMonth?: Pegged;
	price?: number | string | null;
}

interface LlamaDay {
	date: string;
	totalCirculatingUSD?: Pegged;
}

/** Variación en % de b a a, o null si falta alguno. */
function pct(a: number | null, b: number | null): number | null {
	return a !== null && b ? Math.round(((a - b) / b) * 10_000) / 100 : null;
}

/** Las más grandes ligadas al dólar, con su variación y su precio. */
export function toCoins(list: LlamaCoin[]): Stablecoin[] {
	return list
		.filter((c) => c.pegType === 'peggedUSD')
		.map((c) => {
			const usd = num(c.circulating?.peggedUSD) ?? 0;
			return {
				id: String(c.id),
				symbol: c.symbol,
				name: c.name,
				mechanism: c.pegMechanism,
				usd: Math.round(usd),
				week: pct(usd, num(c.circulatingPrevWeek?.peggedUSD)),
				month: pct(usd, num(c.circulatingPrevMonth?.peggedUSD)),
				price: num(c.price)
			};
		})
		.filter((c) => c.usd > 0)
		.sort((a, b) => b.usd - a.usd)
		.slice(0, TOP);
}

/** Suma, en dólares, de todas las stablecoins un día (DefiLlama la da por tipo de paridad). */
const sum = (p: Pegged) => Object.values(p ?? {}).reduce<number>((a, v) => a + (num(v) ?? 0), 0);

/** Total de hoy y variación a 30 días y a un año, con la serie diaria (fechas en segundos Unix). */
export function toTotal(days: LlamaDay[]): Pick<StablecoinsData, 'date' | 'total' | 'totalMonth' | 'totalYear'> {
	const points = days
		.map((d) => ({ t: Number(d.date) * 1000, v: sum(d.totalCirculatingUSD) }))
		.filter((p) => Number.isFinite(p.t) && p.v > 0)
		.sort((a, b) => a.t - b.t);
	const now = points.at(-1);
	if (!now) throw new Error('sin total de stablecoins');
	const ago = (days: number) => {
		const limit = now.t - days * 86_400_000;
		return points.findLast((p) => p.t <= limit)?.v ?? null;
	};
	return {
		date: new Date(now.t).toISOString().slice(0, 10),
		total: Math.round(now.v),
		totalMonth: pct(now.v, ago(30)),
		totalYear: pct(now.v, ago(365))
	};
}

export const stablecoins: Source<StablecoinsData> = {
	name: 'stablecoins',
	label: 'Stablecoins · DefiLlama',
	maxAgeMinutes: 175,
	async fetch() {
		const [list, chart] = await Promise.all([
			getJson<{ peggedAssets?: LlamaCoin[] } | LlamaCoin[]>(`${API}/stablecoins?includePrices=true`),
			getJson<LlamaDay[]>(`${API}/stablecoincharts/all`)
		]);
		// La lista va en «peggedAssets»; por si algún día la devuelven sin envolver, también se acepta suelta.
		const coins = toCoins(Array.isArray(list) ? list : (list.peggedAssets ?? []));
		if (!coins.length) throw new Error('DefiLlama no trae stablecoins');
		return { ...toTotal(chart), coins };
	}
};

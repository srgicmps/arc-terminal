// Mercados de predicción de Polymarket: qué probabilidad da el mercado a cada acontecimiento.
// API pública de solo lectura (sin clave). Las probabilidades son precios de mercado, no pronósticos.
import type { Prediction, PredictionsData } from '../../src/lib/types.ts';
import { getJson, list, num, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

/** Algunos campos llegan como texto JSON: '["Yes","No"]'. */
function parseList(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	try {
		const v = JSON.parse(String(value ?? '[]'));
		return Array.isArray(v) ? v.map(String) : [];
	} catch {
		return [];
	}
}

function toPrediction(e: Raw): Prediction | null {
	const markets = list<Raw>(e.markets).filter((m) => !m.closed && m.active !== false);
	let outcomes: { label: string; p: number }[];
	if (markets.length === 1) {
		// Un solo mercado: sus opciones (normalmente Sí / No).
		const labels = parseList(markets[0].outcomes);
		const prices = parseList(markets[0].outcomePrices).map(num);
		outcomes = labels.map((label, i) => ({ label, p: prices[i] ?? 0 }));
	} else {
		// Varios mercados (fechas, candidatos…): la probabilidad del «Sí» de cada uno.
		outcomes = markets.map((m) => ({
			label: plain(m.groupItemTitle || m.question),
			p: num(parseList(m.outcomePrices)[0]) ?? 0
		}));
	}
	outcomes = outcomes
		.map((o) => ({ label: o.label === 'Yes' ? 'Sí' : o.label === 'No' ? 'No' : o.label, p: o.p ?? 0 }))
		.filter((o) => o.label)
		.sort((a, b) => b.p - a.p)
		.slice(0, 4);
	if (!outcomes.length) return null;
	return {
		id: String(e.id),
		title: plain(e.title),
		url: `https://polymarket.com/event/${e.slug}`,
		volume24h: Number(e.volume24hr ?? 0),
		endDate: String(e.endDate ?? ''),
		outcomes
	};
}

async function events(tag: string, limit: number): Promise<Prediction[]> {
	const params = new URLSearchParams({
		active: 'true',
		closed: 'false',
		order: 'volume24hr',
		ascending: 'false',
		limit: String(limit),
		tag_slug: tag
	});
	const body = await getJson<Raw[]>(`https://gamma-api.polymarket.com/events?${params}`);
	return list(body)
		.map(toPrediction)
		.filter((p): p is Prediction => p !== null);
}

export const predictions: Source<PredictionsData> = {
	name: 'predictions',
	label: 'Mercados de predicción · Polymarket',
	maxAgeMinutes: 55,
	async fetch() {
		const [geopolitics, economy] = await Promise.all([
			events('geopolitics', 12),
			events('economy', 8).catch(() => [])
		]);
		if (!geopolitics.length && !economy.length) throw new Error('sin mercados');
		return { geopolitics, economy };
	}
};

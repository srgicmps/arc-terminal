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

/** Enlace al evento; si no trae slug, al de su mercado (Polymarket redirige al evento). Sin ninguno, null. */
function urlOf(e: Raw, markets: Raw[]): string | null {
	if (typeof e.slug === 'string' && e.slug) return `https://polymarket.com/event/${e.slug}`;
	const slug = markets.map((m) => m.slug).find((s) => typeof s === 'string' && s);
	return slug ? `https://polymarket.com/market/${slug}` : null;
}

function toPrediction(e: Raw): Prediction | null {
	const markets = list<Raw>(e.markets).filter((m) => !m.closed && m.active !== false);
	// Sin precio no hay probabilidad: esas opciones se descartan en vez de mostrarse como 0 %.
	let outcomes: { label: string; p: number | null }[];
	if (markets.length === 1) {
		// Un solo mercado: sus opciones (normalmente Sí / No).
		const labels = parseList(markets[0].outcomes);
		const prices = parseList(markets[0].outcomePrices).map(num);
		outcomes = labels.map((label, i) => ({ label, p: prices[i] ?? null }));
	} else {
		// Varios mercados (fechas, candidatos…): la probabilidad del «Sí» de cada uno.
		outcomes = markets.map((m) => ({
			label: plain(m.groupItemTitle || m.question),
			p: num(parseList(m.outcomePrices)[0])
		}));
	}
	const valid = outcomes
		.filter((o): o is { label: string; p: number } => !!o.label && o.p !== null)
		.map((o) => ({ label: o.label === 'Yes' ? 'Sí' : o.label === 'No' ? 'No' : o.label, p: o.p }))
		.sort((a, b) => b.p - a.p)
		.slice(0, 4);
	const url = urlOf(e, markets);
	if (!valid.length || !url) return null;
	return {
		id: String(e.id),
		title: plain(e.title),
		url,
		volume24h: Number(e.volume24hr ?? 0),
		endDate: String(e.endDate ?? ''),
		outcomes: valid
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
	maxAgeMinutes: 25,
	async fetch() {
		const [geopolitics, economy, rates] = await Promise.all([
			events('geopolitics', 12),
			events('economy', 8).catch(() => []),
			// Decisiones de tipos de la Fed y del BCE, para la próxima reunión que enseña ECO (src/lib/meetings.ts).
			events('fed-rates', 6).catch(() => [])
		]);
		if (!geopolitics.length && !economy.length) throw new Error('sin mercados');
		return { geopolitics, economy, rates };
	}
};

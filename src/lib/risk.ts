// Termómetro de riesgo (risk-on / risk-off) de WS, con datos que ya descarga la Action. Cada indicador se
// compara con su último año (z-score: cuántas desviaciones típicas está por encima o por debajo de su media),
// se le da el signo para que «+» sea apetito por el riesgo y «−» miedo, y la media de todos, de −2,5 a +2,5,
// se pasa a −100…+100. Nada de caja negra: la vista enseña cada componente con su valor y su z.
import type { CryptoData, Point, PredictionsData, SeriesData } from './types.ts';

export interface RiskPart {
	id: string;
	label: string;
	/** Último valor, ya escrito («0,52 %», «18,3»…). */
	value: string;
	/** Fecha del último dato. */
	date: string;
	/** Desviaciones típicas frente a su año, con el signo de riesgo: + risk-on, − risk-off. Entre −3 y 3. */
	z: number;
	/** Qué significa: «más alto = más miedo». */
	reading: string;
	source: string;
}

export interface Risk {
	/** De −100 (risk-off extremo) a +100 (risk-on extremo). */
	score: number;
	parts: RiskPart[];
}

const CLAMP = 3;
/** z medio que equivale a ±100. */
const FULL = 2.5;

const clamp = (v: number, lim = CLAMP) => Math.max(-lim, Math.min(lim, v));

/**
 * z-score del último valor frente a los valores dados (que lo incluyen). null si no hay bastante: hacen falta
 * 10 datos (un año de una serie mensual da 12 o 13).
 */
export function zScore(values: readonly number[]): number | null {
	if (values.length < 10) return null;
	const mean = values.reduce((a, b) => a + b, 0) / values.length;
	const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
	if (!sd) return null;
	return (values.at(-1)! - mean) / sd;
}

/** Puntos del último año contado desde el último dato. */
export function lastYear(points: readonly Point[]): Point[] {
	const last = points.at(-1);
	if (!last) return [];
	const from = new Date(`${last.t.slice(0, 10)}T00:00:00Z`);
	from.setUTCFullYear(from.getUTCFullYear() - 1);
	const cut = from.toISOString().slice(0, 10);
	return points.filter((p) => p.t.slice(0, 10) >= cut);
}

const nf = (v: number, digits = 2) =>
	v.toLocaleString('es-ES', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace('-', '−');
/** Con signo siempre: «+4,5 %», «−6,2 %». */
const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${nf(v, digits)} %`;

/** Diferencia de dos series por periodo, en puntos porcentuales (primas: bono de un país menos el alemán). */
export function spread(a: readonly Point[], b: readonly Point[]): Point[] {
	const other = new Map(b.map((p) => [p.t, p.v]));
	return a
		.filter((p) => other.has(p.t))
		.map((p) => ({ t: p.t, v: Math.round((p.v - other.get(p.t)!) * 10000) / 10000 }));
}

/** Variaciones a 7 días (%) de una serie diaria de precios. */
export function weeklyChanges(history: readonly { date: string; usd: number }[]): Point[] {
	const byDate = new Map(history.map((h) => [h.date, h.usd]));
	const out: Point[] = [];
	for (const h of history) {
		const d = new Date(`${h.date}T00:00:00Z`);
		d.setUTCDate(d.getUTCDate() - 7);
		const before = byDate.get(d.toISOString().slice(0, 10));
		if (before) out.push({ t: h.date, v: (h.usd / before - 1) * 100 });
	}
	return out;
}

interface Inputs {
	fred?: SeriesData | null;
	ecb?: SeriesData | null;
	crypto?: CryptoData | null;
	predictions?: PredictionsData | null;
}

/** Un componente a partir de una serie: z del último año con el signo `sign` (+1 si subir es risk-on). */
function fromSeries(
	id: string,
	label: string,
	points: readonly Point[] | undefined,
	sign: 1 | -1,
	fmt: (v: number) => string,
	reading: string,
	source: string
): RiskPart | null {
	if (!points?.length) return null;
	const year = lastYear(points);
	const z = zScore(year.map((p) => p.v));
	if (z === null) return null;
	const last = points.at(-1)!;
	return { id, label, value: fmt(last.v), date: last.t, z: clamp(sign * z), reading, source };
}

/** Probabilidad de recesión en EE. UU. en Polymarket (el primer mercado que la nombre), de 0 a 1. */
export function recessionOdds(p: PredictionsData | null | undefined): { p: number; title: string } | null {
	const market = [...(p?.economy ?? []), ...(p?.geopolitics ?? [])].find((m) => /recession/i.test(m.title));
	const yes = market?.outcomes.find((o) => /^(yes|sí)$/i.test(o.label));
	return market && yes ? { p: yes.p, title: market.title } : null;
}

export function computeRisk(input: Inputs): Risk {
	const fred = new Map((input.fred?.series ?? []).map((s) => [s.id, s.points]));
	const ecb = new Map((input.ecb?.series ?? []).map((s) => [s.id, s.points]));
	const de = ecb.get('bond10-de') ?? [];
	const parts: (RiskPart | null)[] = [
		fromSeries(
			'vix',
			'VIX (volatilidad del S&P 500)',
			fred.get('vix'),
			-1,
			(v) => nf(v, 1),
			'Más alto, más miedo',
			'FRED (Cboe)'
		),
		fromSeries(
			't10y2y',
			'Curva EE. UU. 10A − 2A',
			fred.get('t10y2y-us'),
			1,
			(v) => `${nf(v)} %`,
			'Invertida, aviso de recesión',
			'FRED'
		),
		fromSeries(
			'spread-it',
			'Prima de riesgo de Italia',
			spread(ecb.get('bond10-it') ?? [], de),
			-1,
			(v) => `${nf(v * 100, 0)} pb`,
			'Más alta, más tensión',
			'BCE'
		),
		fromSeries(
			'spread-es',
			'Prima de riesgo de España',
			spread(ecb.get('bond10-es') ?? [], de),
			-1,
			(v) => `${nf(v * 100, 0)} pb`,
			'Más alta, más tensión',
			'BCE'
		),
		fromSeries('eurusd', 'EUR/USD', ecb.get('eurusd'), 1, (v) => nf(v, 4), 'Dólar fuerte, refugio', 'BCE')
	];

	// Bitcoin a 7 días: con un año de historial, su z; si aún no lo hay, la variación de CoinGecko entre su
	// volatilidad semanal típica (en torno al 9 %).
	const btc = input.crypto?.coins.find((c) => c.id === 'bitcoin');
	const weekly = weeklyChanges(input.crypto?.btcHistory ?? []);
	const btcPart = fromSeries(
		'btc',
		'Bitcoin a 7 días',
		weekly,
		1,
		(v) => signed(v),
		'Sube con el apetito',
		'CoinGecko'
	);
	if (btcPart) parts.push(btcPart);
	else if (btc?.change7d != null)
		parts.push({
			id: 'btc',
			label: 'Bitcoin a 7 días',
			value: signed(btc.change7d),
			date: '',
			z: clamp(btc.change7d / 9),
			reading: 'Sube con el apetito; sin un año de historial, entre su 9 % semanal típico',
			source: 'CoinGecko'
		});

	// Recesión en Polymarket: no hay historial; se compara con un 25 % (un año normal) en pasos de 10 puntos.
	const rec = recessionOdds(input.predictions);
	if (rec)
		parts.push({
			id: 'recession',
			label: 'Recesión en EE. UU. (Polymarket)',
			value: `${nf(rec.p * 100, 0)} %`,
			date: '',
			z: clamp(-(rec.p - 0.25) / 0.1),
			reading: 'Más probable, más miedo; frente a un 25 %',
			source: 'Polymarket'
		});

	const ok = parts.filter((p): p is RiskPart => p !== null);
	const mean = ok.length ? ok.reduce((a, p) => a + p.z, 0) / ok.length : 0;
	return { score: Math.round(clamp(mean, FULL) * (100 / FULL)), parts: ok };
}

/** «Risk-on», «Neutral»… para el número. */
export function riskLabel(score: number): string {
	if (score >= 40) return 'Risk-on fuerte';
	if (score >= 15) return 'Risk-on';
	if (score > -15) return 'Neutral';
	if (score > -40) return 'Risk-off';
	return 'Risk-off fuerte';
}

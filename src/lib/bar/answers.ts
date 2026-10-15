// Respuestas instantáneas de la barra (lote 27-A): «euribor», «prima», «btc», «diésel», «paro es»,
// «hipoteca 150000 25a», «llenar 50L»… Enseñan el dato bajo la barra sin cambiar de vista; Intro abre `open`.
// Lógica pura: los datos llegan con `get(nombre)` (el `data` de static/data/<nombre>.json). Los descarga
// bardata.svelte.ts la primera vez que hacen falta (como el conversor de divisas).
import { nf, period, signed } from '../format.ts';
import { monthlyPayment } from '../mortgage.ts';
import { last } from '../series.ts';
import type { FuelData, FuelPrices, FuelSpainData } from '../fuel.ts';
import type { CryptoData, Series, SeriesData, YieldCurveData } from '../types.ts';
import { clockAnswer } from './clock.ts';
import { parsePeriod, rangeSince, sinceInput } from './ranges.ts';
import { PERF_PERIODS } from '../cmp.ts';
import type { PerfData } from '../types.ts';

/** Una respuesta: código y texto, como una sugerencia. Sin `open`, Intro no hace nada. */
export interface Answer {
	code: string;
	desc: string;
	open?: string;
}

/**
 * `data` de un archivo: undefined mientras se descarga, null si no se ha podido. `fuelZone` es la última zona
 * elegida en FUEL (clave fuel-zone): «menorca» o el número de la provincia.
 */
export interface AnswerCtx {
	get: (name: string) => unknown;
	now: number;
	fuelZone?: string | null;
}

/** Sin tildes, en minúsculas, sin ¿?¡! y con un solo espacio: «¿Cuándo es el próximo BCE?» → «cuando es el proximo bce». */
export const plain = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[¿?¡!]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

/** Una serie que se puede consultar por su nombre. `daily`: compara con hace una semana; si no, con hace un año. */
interface SeriesTopic {
	keys: string[];
	set: string;
	id: string;
	label: string;
	dec: number;
	open: string;
	daily?: boolean;
}

const SERIES: SeriesTopic[] = [
	{ keys: ['euribor', 'euribor 12m', 'euribor 12 meses'], set: 'ecb', id: 'euribor-12m', label: 'Euríbor 12 m', dec: 3, open: 'BTMM' },
	{ keys: ['euribor 3m', 'euribor 3 meses'], set: 'ecb', id: 'euribor-3m', label: 'Euríbor 3 m', dec: 3, open: 'BTMM' },
	{ keys: ['prima', 'prima de riesgo', 'prima espana'], set: 'bde', id: 'premium-es-d', label: 'Prima de riesgo', dec: 0, open: 'ECO', daily: true },
	{ keys: ['bund', 'bono aleman'], set: 'bde', id: 'bond10-de-d', label: 'Bund 10 a', dec: 2, open: 'ECO', daily: true },
	{ keys: ['bono', 'bono espanol', 'bono es', 'bono 10a'], set: 'bde', id: 'bond10-es-d', label: 'Bono español 10 a', dec: 2, open: 'ECO', daily: true },
	{ keys: ['tipos', 'tipos bce', 'tipo bce', 'bce tipos', 'facilidad de deposito'], set: 'ecb', id: 'ecb-dfr', label: 'BCE, facilidad de depósito', dec: 2, open: 'ECO', daily: true },
	{ keys: ['estr', '€str'], set: 'ecb', id: 'estr', label: '€STR', dec: 3, open: 'BTMM', daily: true },
	{ keys: ['fed', 'tipos fed', 'fed funds'], set: 'fred', id: 'fedfunds-us', label: 'Fed funds', dec: 2, open: 'ECO', daily: true },
	{ keys: ['eurusd', 'eur usd', 'euro dolar', 'dolar'], set: 'ecb', id: 'eurusd', label: 'EUR/USD (BCE)', dec: 4, open: 'WS', daily: true },
	{ keys: ['wti', 'petroleo', 'crudo'], set: 'fred', id: 'wti', label: 'Petróleo WTI', dec: 2, open: 'WS', daily: true }
];

/** País del paro y de la inflación: código de la barra → sufijo de la serie y nombre. */
const GEOS: Record<string, { id: string; name: string }> = {
	es: { id: 'es', name: 'España' },
	espana: { id: 'es', name: 'España' },
	de: { id: 'de', name: 'Alemania' },
	alemania: { id: 'de', name: 'Alemania' },
	fr: { id: 'fr', name: 'Francia' },
	francia: { id: 'fr', name: 'Francia' },
	it: { id: 'it', name: 'Italia' },
	italia: { id: 'it', name: 'Italia' },
	pt: { id: 'pt', name: 'Portugal' },
	portugal: { id: 'pt', name: 'Portugal' },
	ue: { id: 'eu', name: 'UE' },
	eu: { id: 'eu', name: 'UE' },
	ea: { id: 'ea', name: 'Zona euro' },
	'zona euro': { id: 'ea', name: 'Zona euro' },
	us: { id: 'us', name: 'EE. UU.' },
	eeuu: { id: 'us', name: 'EE. UU.' },
	'ee uu': { id: 'us', name: 'EE. UU.' }
};

/** «paro es», «inflación it»: el tema, el país y de dónde sale. null si no lo es. */
export function geoTopic(q: string, harmonized = false): SeriesTopic | null {
	const m = q.match(/^(paro|desempleo|ipc|inflacion)(?: (?:de |en )?(.+))?$/);
	if (!m) return null;
	const geo = GEOS[m[2] ?? 'es'];
	if (!geo) return null;
	const name = geo.name;
	if (m[1] === 'paro' || m[1] === 'desempleo') {
		const set = geo.id === 'us' ? 'bls' : 'eurostat';
		return { keys: [], set, id: `unemployment-${geo.id}`, label: `Paro ${geo.name}`, dec: 1, open: 'ECO Paro' };
	}
	if (geo.id === 'us') return null; // el IPC de EE. UU. del BLS es un índice, no una tasa
	// Para comparar países, la inflación armonizada de Eurostat de todos (también la de España).
	if (geo.id === 'es' && !harmonized) return { keys: [], set: 'ine', id: 'ipc-es', label: 'IPC España', dec: 1, open: 'ES' };
	return { keys: [], set: 'eurostat', id: `inflation-${geo.id}`, label: `Inflación ${name}`, dec: 1, open: 'ECO' };
}

/** «euribor», «paro es»: la serie de la que se habla. */
const seriesTopic = (q: string) => SERIES.find((t) => t.keys.includes(q)) ?? geoTopic(q);

/** «paro es vs it», «es vs it paro», «inflación de vs fr»: las dos series que se comparan. */
export function compareSeries(q: string): [SeriesTopic, SeriesTopic] | null {
	const VS = '(?:vs\\.?|versus|contra|frente a)';
	const TOPIC = '(paro|desempleo|ipc|inflacion)';
	let parts = q.match(new RegExp(`^${TOPIC} (?:de |en )?(.+?) ${VS} (.+)$`))?.slice(1);
	if (!parts) {
		const n = q.match(new RegExp(`^(.+?) ${VS} (.+?) ${TOPIC}$`));
		parts = n ? [n[3], n[1], n[2]] : undefined;
	}
	if (!parts) return null;
	const [topic, g1, g2] = parts;
	const a = geoTopic(`${topic} ${g1}`, true);
	const b = geoTopic(`${topic} ${g2}`, true);
	return a && b && a.id !== b.id ? [a, b] : null;
}

/**
 * Los archivos que necesita lo escrito (para descargarlos), vacío si no es una respuesta. Se averigua
 * preguntando: cada respuesta pide sus archivos con `get` antes de mirar si han llegado.
 */
export function answerNeeds(raw: string, fuelZone?: string | null, now = Date.now()): string[] {
	const names = new Set<string>();
	answerFor(raw, { get: (n) => void names.add(n), now, fuelZone });
	return [...names];
}

const FUEL_WORDS = /^(diesel|gasoil|gasoleo|gasolina|gasolina 95|g95|sin plomo)$/;

/** La respuesta a lo escrito, o null si no es una de las que sabe la barra. */
export function answerFor(raw: string, ctx: AnswerCtx): Answer | null {
	const q = plain(raw);
	if (!q) return null;
	const clock = clockAnswer(q, ctx.now);
	if (clock) return clock;
	const topic = seriesTopic(q);
	if (topic) return seriesAnswer(topic, ctx);
	// «paro es 10a», «euribor 1a»: el dato y cuánto ha cambiado en ese periodo.
	const pm = q.match(/^(.+) (\S+)$/);
	const period = pm ? parsePeriod(pm[2]) : null;
	const ptopic = period && pm ? seriesTopic(pm[1]) : null;
	if (ptopic && period) return seriesAnswer(ptopic, ctx, period.days);
	const versus = compareSeries(q);
	if (versus) return versusAnswer(versus, ctx);
	const since = sinceInput(raw);
	if (since) return sinceAnswer(since.sym, since.date, ctx);
	if (/^(btc|bitcoin|eth|ether|ethereum)$/.test(q)) return cryptoAnswer(q.startsWith('b') ? 'bitcoin' : 'ethereum', ctx);
	if (/^(us10y|10a us|bono us|bono ee ?uu|treasury)$/.test(q)) return treasuryAnswer(ctx);
	// «hipoteca» sola abre la vista HIPOTECA; con cifras, la cuota bajo la barra.
	if (q.startsWith('hipoteca ')) return mortgageAnswer(q, ctx);
	if (FUEL_WORDS.test(q)) return fuelAnswer(null, /^(diesel|gasoil|gasoleo)$/.test(q) ? 'diesel' : 'g95', ctx);
	const fill = q.match(/^(?:llenar|repostar)(?: (\d+(?:[.,]\d+)?) ?(?:l|litros)?)?(?: (?:de )?(diesel|gasoil|gasoleo|gasolina|g95))?$/);
	if (fill) return fuelAnswer(fill[1] ? Number(fill[1].replace(',', '.')) : null, fill[2] && /^(gasolina|g95)$/.test(fill[2]) ? 'g95' : fill[2] ? 'diesel' : null, ctx);
	return null;
}

/** El dato aún no está o no se ha podido descargar. */
function pending(code: string, value: unknown, open?: string): Answer {
	return { code, desc: value === undefined ? 'Cargando…' : 'No se ha podido cargar el dato', open };
}

/** La serie de un tema, o la respuesta de «cargando» / «sin dato». */
function topicSeries(t: SeriesTopic, ctx: AnswerCtx): Series | Answer {
	const code = t.label.toUpperCase();
	const data = ctx.get(t.set) as SeriesData | null | undefined;
	if (!data) return pending(code, data, t.open);
	const s = data.series?.find((x) => x.id === t.id);
	return s && s.points.length ? s : { code, desc: 'Sin dato ahora mismo', open: t.open };
}

const unitOf = (s: Series) => (s.unit === '%' ? ' %' : ` ${s.unit}`);

/** Con `days`, compara con el dato de hace ese tiempo (si la serie llega tan atrás; si no, lo dice). */
function seriesAnswer(t: SeriesTopic, ctx: AnswerCtx, days?: number): Answer {
	const code = t.label.toUpperCase();
	const s = topicSeries(t, ctx);
	if (!('points' in s)) return s;
	const p = s.points[s.points.length - 1];
	const unit = unitOf(s);
	if (days !== undefined) {
		const first = s.points[0];
		const from = days === Infinity ? first : pointBefore(s, p.t, days);
		const pp = s.unit === '%' ? ' pp' : '';
		if (!from) return { code, desc: `${nf(p.v, t.dec)}${unit} · ${period(p.t)} · aquí solo hay datos desde ${period(first.t)} (${nf(first.v, t.dec)}${unit}, ${signed(p.v - first.v, t.dec)}${pp})`, open: t.open };
		return { code, desc: `${nf(from.v, t.dec)}${unit} (${period(from.t)}) → ${nf(p.v, t.dec)}${unit} (${period(p.t)}) · ${signed(p.v - from.v, t.dec)}${pp} · ${s.source}`, open: t.open };
	}
	const before = t.daily ? weekAgo(s, p.t) : yearAgo(s, p.t);
	const diff = before ? ` · ${signed(p.v - before.v, t.dec)}${s.unit === '%' ? ' pp' : ''} ${t.daily ? 'en una semana' : 'en un año'}` : '';
	return { code, desc: `${nf(p.v, t.dec)}${unit} · ${period(p.t)}${diff} · ${s.source}`, open: t.open };
}

/** El último punto de hace al menos `days` días respecto a `t`; undefined si la serie no llega tan atrás. */
function pointBefore(s: Series, t: string, days: number) {
	const end = Date.parse(`${toDay(t)}T12:00:00Z`);
	const limit = new Date(end - days * 86_400_000).toISOString().slice(0, 10);
	const p = s.points.findLast((x) => toDay(x.t) <= limit);
	return p === s.points[s.points.length - 1] ? undefined : p;
}

/** «2026-09» → «2026-09-01», «2026-Q2» → «2026-04-01», «2026-10-14» igual: para comparar fechas. */
function toDay(t: string): string {
	const q = t.match(/^(\d{4})-Q(\d)$/);
	if (q) return `${q[1]}-${String((Number(q[2]) - 1) * 3 + 1).padStart(2, '0')}-01`;
	return /^\d{4}-\d{2}$/.test(t) ? `${t}-01` : t.slice(0, 10);
}

/** «paro es vs it»: los dos últimos datos y la diferencia. */
function versusAnswer([a, b]: [SeriesTopic, SeriesTopic], ctx: AnswerCtx): Answer {
	const sa = topicSeries(a, ctx);
	const sb = topicSeries(b, ctx);
	if (!('points' in sa)) return sa;
	if (!('points' in sb)) return sb;
	const pa = sa.points[sa.points.length - 1];
	const pb = sb.points[sb.points.length - 1];
	const name = (t: SeriesTopic) => t.label.replace(/^(Paro|Inflación) /, '');
	const topic = a.label.split(' ')[0];
	const pp = sa.unit === '%' ? ' pp' : '';
	const when = pa.t === pb.t ? period(pa.t) : `${period(pa.t)} y ${period(pb.t)}`;
	return {
		code: `${topic.toUpperCase()}`,
		desc: `${name(a)} ${nf(pa.v, a.dec)}${unitOf(sa)} · ${name(b)} ${nf(pb.v, b.dec)}${unitOf(sb)} · diferencia ${signed(pa.v - pb.v, a.dec)}${pp} · ${when} · ${sa.source}`,
		open: a.open
	};
}

/**
 * «NVDA desde 2024-01-01». Arc Terminal no guarda cierres diarios de los valores: lo dice, enseña las
 * rentabilidades fijas de Finnhub que haya (perf.json) e Intro abre el gráfico con el rango que cubre ese día.
 */
function sinceAnswer(sym: string, date: string, ctx: AnswerCtx): Answer {
	const range = rangeSince(date, ctx.now);
	const open = `${sym} ${range.tv}`;
	const data = ctx.get('perf') as PerfData | null | undefined;
	const r = data?.symbols?.[sym];
	const fixed = r
		? PERF_PERIODS.filter(([k]) => typeof r[k] === 'number')
				.map(([k, label]) => `${label} ${signed(r[k], 1)} %`)
				.join(' · ')
		: '';
	const head = `Sin histórico de cierres para calcular desde ${date}`;
	if (data === undefined) return { code: sym, desc: `${head} · Cargando rentabilidades…`, open };
	return { code: sym, desc: fixed ? `${head}. Rentabilidad: ${fixed}` : `${head}. Intro abre el gráfico (${range.label})`, open };
}

/** El punto de hace un año (series mensuales o trimestrales). */
function yearAgo(s: Series, t: string) {
	const m = t.match(/^(\d{4})(-.+)$/);
	return m ? s.points.find((p) => p.t === `${Number(m[1]) - 1}${m[2]}`) : undefined;
}

/** El último punto de hace al menos 7 días (series diarias). */
function weekAgo(s: Series, t: string) {
	const limit = new Date(Date.parse(`${t.slice(0, 10)}T12:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10);
	return s.points.findLast((p) => p.t <= limit);
}

function cryptoAnswer(id: 'bitcoin' | 'ethereum', ctx: AnswerCtx): Answer {
	const code = id === 'bitcoin' ? 'BTC' : 'ETH';
	const data = ctx.get('crypto') as CryptoData | null | undefined;
	if (!data) return pending(code, data, 'WS');
	const c = data.coins?.find((x) => x.id === id);
	if (!c) return { code, desc: 'Sin dato ahora mismo', open: 'WS' };
	const d24 = c.change24h !== null && c.change24h !== undefined ? ` · ${signed(c.change24h, 1)} % en 24 h` : '';
	return { code, desc: `${nf(c.usd, 0)} $ · ${nf(c.eur, 0)} €${d24} · CoinGecko`, open: 'WS' };
}

function treasuryAnswer(ctx: AnswerCtx): Answer {
	const code = 'US 10 A';
	const data = ctx.get('uscurve') as YieldCurveData | null | undefined;
	if (!data) return pending(code, data, 'WS');
	const i = data.tenors?.indexOf('10A') ?? -1;
	const day = data.days?.findLast((d) => d.values[i] !== null && d.values[i] !== undefined);
	if (i < 0 || !day) return { code, desc: 'Sin dato ahora mismo', open: 'WS' };
	return { code, desc: `${nf(day.values[i], 2)} % · ${period(day.date)} · Tesoro de EE. UU.`, open: 'WS Curvas de tipos' };
}

/** «150000», «150.000», «150k», «150 mil» → 150000. */
export function parseAmount(s: string): number | null {
	const m = s.match(/^(\d+(?:[.,]\d+)?)\s*(k|mil)?$/);
	if (!m) return null;
	const raw = m[2] ? m[1].replace(',', '.') : m[1].replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
	const n = Number(raw) * (m[2] ? 1000 : 1);
	return Number.isFinite(n) && n > 0 ? n : null;
}

/** «hipoteca 150000 25a 0,75»: capital, años y diferencial (por defecto 0,75, como HIPOTECA). */
export function parseMortgage(q: string): { capital: number; years: number; spread: number } | null {
	const m = q.match(/^hipoteca (\S+(?: mil)?) (\d+) ?(?:a|anos)?(?: (?:\+ ?)?(\d+(?:[.,]\d+)?) ?%?)?$/);
	if (!m) return null;
	const capital = parseAmount(m[1]);
	const years = Number(m[2]);
	const spread = m[3] ? Number(m[3].replace(',', '.')) : 0.75;
	return capital && years > 0 && years <= 50 && spread < 10 ? { capital, years, spread } : null;
}

function mortgageAnswer(q: string, ctx: AnswerCtx): Answer {
	const code = 'HIPOTECA';
	const open = 'HIPOTECA';
	const form = parseMortgage(q);
	if (!form) return { code, desc: 'Escribe capital y años: «hipoteca 150000 25a» (y, si quieres, el diferencial: «0,75»)', open };
	const data = ctx.get('ecb') as SeriesData | null | undefined;
	if (!data) return pending(code, data, open);
	const p = last(data.series?.find((s) => s.id === 'euribor-12m'));
	if (!p) return { code, desc: 'Sin euríbor ahora mismo', open };
	const rate = p.v + form.spread;
	const pay = monthlyPayment(form.capital, form.years, rate);
	if (pay === null) return { code, desc: 'No sale la cuenta con esos datos', open };
	const interest = pay * form.years * 12 - form.capital;
	return {
		code,
		desc: `${nf(pay, 2)} €/mes · euríbor ${period(p.t)} ${nf(p.v, 3)} % + ${nf(form.spread, 2)} · ${nf(interest, 0)} € de intereses en ${form.years} años`,
		open
	};
}

const FUEL_NAME = { g95: 'gasolina 95', diesel: 'diésel' } as const;

/**
 * «diésel», «gasolina»: el precio en tu zona de FUEL (la más barata y la media) y la media de España.
 * «llenar 50L»: lo que cuesta el depósito en la gasolinera más barata de tu zona, con los dos combustibles
 * si no dices cuál.
 */
function fuelAnswer(litres: number | null, fuel: keyof typeof FUEL_NAME | null, ctx: AnswerCtx): Answer {
	const code = litres ? `${nf(litres, 0)} L` : fuel ? FUEL_NAME[fuel].toUpperCase() : 'LLENAR';
	if (litres !== null && !(litres > 0 && litres <= 200)) return { code, desc: 'Escribe los litros: «llenar 50L» o «llenar 40 diésel»', open: 'FUEL' };
	const spain = ctx.get('fuel-es') as FuelSpainData | null | undefined;
	const zone = ctx.fuelZone || 'menorca';
	const local = zone === 'menorca' ? (ctx.get('fuel') as FuelData | null | undefined) : undefined;
	if (!spain || (zone === 'menorca' && !local)) return pending(code, spain === null || local === null ? null : undefined, 'FUEL');
	let name = 'España';
	let min: Partial<FuelPrices> = spain.avg;
	let open = 'FUEL';
	if (zone === 'menorca' && local) {
		name = 'Menorca';
		min = cheapest(local.stations ?? []);
	} else {
		const p = spain.provinces?.find((x) => x.id === zone);
		if (p) {
			name = p.name;
			min = p.min;
			open = `FUEL ${p.name}`;
		}
	}
	const fuels = fuel ? [fuel] : (['g95', 'diesel'] as const);
	const parts = fuels.map((f) => {
		const price = min[f];
		const avg = spain.avg?.[f];
		if (price === null || price === undefined) return `${FUEL_NAME[f]}: sin dato`;
		if (litres) return `${FUEL_NAME[f]} ${nf(price * litres, 2)} € (${nf(price, 3)} €/L)`;
		return `${FUEL_NAME[f]} ${nf(price, 3)} €/L la más barata${avg ? ` · media de España ${nf(avg, 3)}` : ''}`;
	});
	const where = litres ? ` en la más barata de ${name}` : ` en ${name}`;
	return { code, desc: `${parts.join(' · ')}${where}`, open };
}

/** El precio más bajo de cada combustible entre unas gasolineras. */
function cheapest(stations: FuelData['stations']): Partial<FuelPrices> {
	const out: Partial<FuelPrices> = {};
	for (const f of ['g95', 'diesel'] as const) {
		const prices = stations.map((s) => s.prices?.[f]).filter((v): v is number => typeof v === 'number' && v > 0);
		out[f] = prices.length ? Math.min(...prices) : null;
	}
	return out;
}

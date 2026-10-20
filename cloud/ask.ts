// «PREGUNTA» (F43): /api/ask. Es la ÚNICA pieza de Arc con IA, aparte, etiquetada y opcional. Lo demás (la barra,
// IMP, QUIEN, TEST, los avisos…) sigue sin IA y no cambia.
// - Solo personas con cuenta: person() de access.ts (misma web y JWT de Access verificado).
// - GET: cuántas lleva hoy y el tope. POST { q }: { answer, sources: [{ name, label, fetchedAt }] }.
// - Contexto: de 1 a 4 JSON de hoy (static/data), elegidos por palabras clave con los atajos de G (gseries.ts) y
//   los alias de los comandos, leídos con env.ASSETS y recortados a unos 8 KB. Nada de la web de fuera. Cada lista
//   recortada lo dice, con sus extremos (o su resumen por día) calculados con todo, y el prompt lleva la hora de ahora.
// - Workers AI con el binding AI de wrangler.toml (lo deja o lo quita scripts/cf-config.ts). Modelo y coste: MODEL.
// - Comprobación determinista al final: cada cifra de la respuesta tiene que estar en el contexto (o en la propia
//   pregunta). Si no, la respuesta se descarta y sale «No lo sé con los datos de hoy».
// - Tope: 20 al día por persona (tabla ask_count: solo cuántas, nunca la pregunta ni la respuesta).
// - Sin binding AI, sin ASSETS o sin base: 503 «sin configurar», y la vista lo dice.
import { SHORTCUTS, extract, type CatalogEntry } from '../src/lib/gseries.ts';
import agua from '../src/lib/commands/agua.ts';
import ai from '../src/lib/commands/ai.ts';
import btmm from '../src/lib/commands/btmm.ts';
import cal from '../src/lib/commands/cal.ts';
import eco from '../src/lib/commands/eco.ts';
import es from '../src/lib/commands/es.ts';
import fuel from '../src/lib/commands/fuel.ts';
import geo from '../src/lib/commands/geo.ts';
import hipoteca from '../src/lib/commands/hipoteca.ts';
import imp from '../src/lib/commands/imp.ts';
import luz from '../src/lib/commands/luz.ts';
import tech from '../src/lib/commands/tech.ts';
import wb from '../src/lib/commands/wb.ts';
import ws from '../src/lib/commands/ws.ts';
import wx from '../src/lib/commands/wx.ts';
import { person } from './access.ts';
import { json, type D1Database, type Env } from './prefs.ts';
import { ensure } from './schema.ts';

/**
 * Modelo de Workers AI: Gemma 4 26B A4B (Google, en Workers AI desde abril de 2026). Multilingüe (buen español),
 * 256.000 tokens de contexto y barato: 9.091 neurons por millón de tokens de entrada y 27.273 por millón de salida
 * (tabla de precios de Cloudflare, octubre de 2026). Una pregunta (~3.000 tokens de contexto y ~300 de respuesta)
 * gasta unas 35 neurons. La cuota gratuita es de 10.000 neurons al día (plan Free y de pago; se reinicia a las
 * 00:00 UTC): da para unas 280 preguntas al día. En el plan Free, al pasarla, Workers AI da error (nunca cobra) y
 * aquí sale 503. Si Cloudflare lo retira, se cambia aquí: https://developers.cloudflare.com/workers-ai/models/
 */
export const MODEL = '@cf/google/gemma-4-26b-a4b-it';

export const ASK_LIMITS = {
	/** Preguntas por persona y día (UTC, como la cuota de Workers AI). */
	perDay: 20,
	question: 300,
	body: 2_000,
	/** Contexto total que se manda al modelo, en caracteres. */
	context: 8_000,
	datasets: 4,
	series: 3,
	/** Tokens de respuesta como mucho (también es el tope de lo que cuesta). */
	tokens: 400,
	answer: 1_200,
	/** Días que se guardan los contadores (para medir el uso). */
	keepDays: 31
};

export const NO_SE = 'No lo sé con los datos de hoy.';

/** Lo mínimo del binding de Workers AI (así no hacen falta los tipos de Cloudflare). */
export interface AiBinding {
	run(model: string, input: Record<string, unknown>): Promise<unknown>;
}
/** Los archivos estáticos de la propia web (static/data), sin pasar por Access. */
export interface Assets {
	fetch(input: string): Promise<Response>;
}
export interface AskEnv extends Env {
	AI?: AiBinding;
	ASSETS?: Assets;
}

export interface AskStore {
	/** Cuántas lleva `user` el día `day` («AAAA-MM-DD»). */
	used(user: string, day: string): Promise<number>;
	/** Apunta una si no ha llegado al tope; false si ya estaba en él. */
	take(user: string, day: string, limit: number): Promise<boolean>;
	/** Al acabar: «failed» la devuelve (la IA no respondió) y «rejected» apunta que la comprobación la descartó. */
	settle(user: string, day: string, outcome: 'ok' | 'rejected' | 'failed'): Promise<void>;
}

export interface Source {
	name: string;
	label: string;
	fetchedAt: string;
}

// ---------- Elegir los datos ----------

/** Sin tildes y en minúsculas. */
const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();

/** Sin tildes, en minúsculas y solo letras y números, con un espacio a cada lado: para buscar palabras enteras. */
export const plain = (s: string) => ` ${fold(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

const hasWord = (text: string, phrase: string) => {
	const p = plain(phrase);
	return p.trim() !== '' && text.includes(p);
};

interface Topic {
	/** El comando de la barra del tema: su código, su nombre corto y sus alias también eligen estos datos. */
	cmd?: { code: string; key: string; aliases?: string[] };
	/** Más palabras que no están en los alias. */
	words?: string[];
	ds: string[];
}

/** Cada tema y sus JSON de static/data. Lo primero de `ds` es lo más útil. */
export const TOPICS: Topic[] = [
	{ cmd: fuel, words: ['gasolinera', 'gasolineras', 'repostar', 'gasoleo', 'gasolinas'], ds: ['fuel-es', 'oilbulletin'] },
	{ cmd: luz, words: ['kwh', 'mwh', 'tarifa'], ds: ['power'] },
	{ cmd: wx, words: ['lluvia', 'llover', 'llovera', 'temperatura', 'calor', 'frio', 'viento'], ds: ['weather'] },
	{ cmd: btmm, ds: ['ecb', 'nyfed'] },
	{ cmd: hipoteca, words: ['bce'], ds: ['ecb'] },
	{ words: ['fed', 'reserva federal', 'effr', 'fondos federales'], ds: ['nyfed', 'bis'] },
	{ words: ['bancos centrales', 'tipo oficial', 'tipos oficiales', 'tipos de interes'], ds: ['bis'] },
	{ cmd: wb, ds: ['uscurve', 'eacurve'] },
	{ cmd: ws, words: ['bitcoin', 'cripto', 'criptomonedas', 'ethereum', 'volatilidad', 'vix'], ds: ['crypto', 'vix', 'news-ws'] },
	{ cmd: geo, words: ['terremoto', 'terremotos', 'sismo', 'seismo', 'guerra'], ds: ['quakes', 'news-geo'] },
	{ cmd: eco, words: ['economia', 'pib'], ds: ['news-eco'] },
	{ cmd: es, ds: ['news-es', 'paro'] },
	{ words: ['paro', 'parados', 'desempleo', 'afiliados', 'afiliacion'], ds: ['paro'] },
	{ cmd: tech, words: ['tecnologia'], ds: ['news-tech'] },
	{ cmd: ai, words: ['inteligencia artificial'], ds: ['news-ai'] },
	{ cmd: imp, words: ['noticias', 'titulares', 'pasado', 'ocurrido', 'novedades'], ds: ['imp'] },
	{ cmd: cal, words: ['festivo', 'calendario'], ds: ['releases-cal', 'holidays'] },
	{ cmd: agua, ds: ['water'] },
	{ words: ['refugiados', 'desplazados', 'acnur'], ds: ['unhcr'] },
	{ words: ['elecciones', 'electoral', 'votaciones'], ds: ['elections'] },
	{ words: ['vivienda', 'viviendas', 'alquiler'], ds: ['housing'] },
	{ words: ['petroleo', 'brent', 'crudo', 'cobre', 'trigo', 'materias primas'], ds: ['pinksheet'] },
	{ words: ['polymarket', 'apuestas', 'probabilidad'], ds: ['predictions'] }
];

/** Palabras que no sirven para elegir una serie por su nombre. */
const STOP = new Set(
	'para como esta este esto cual cuales cuanto cuanta donde cuando desde hasta entre sobre tipo tipos precio precios dato datos serie series indice total media anual mensual meses anos zona'.split(
		' '
	)
);

/** Las palabras de un nombre que sirven para reconocerlo: las cifras («10» años) y las de 4 letras o más. */
const keyWords = (name: string) =>
	[...new Set(plain(name).trim().split(' '))].filter((w) => /^\d+$/.test(w) || (w.length >= 4 && !STOP.has(w)));

/** Países y zonas, como se escriben (sin tildes) → su código, el de `geo` en el catálogo. */
const COUNTRIES: [string, string][] = [
	['estados unidos', 'US'],
	['ee uu', 'US'],
	['eeuu', 'US'],
	['usa', 'US'],
	['espana', 'ES'],
	['alemania', 'DE'],
	['francia', 'FR'],
	['italia', 'IT'],
	['portugal', 'PT'],
	['japon', 'JP'],
	['reino unido', 'GB'],
	['china', 'CN'],
	['zona euro', 'EA'],
	['eurozona', 'EA']
];
const countriesIn = (text: string) => new Set(COUNTRIES.filter(([w]) => text.includes(` ${w} `)).map(([, c]) => c));
const countryName = (geo: string | undefined) => COUNTRIES.find(([, c]) => c === geo)?.[0] ?? '';
/** Las palabras de los países: no cuentan como palabras del nombre de una serie (ya cuenta el país). */
const countryWords = new Set(COUNTRIES.flatMap(([w]) => w.split(' ')));

export interface DataPick {
	/** Los archivos de static/data, de más a menos útil. */
	ds: string[];
	/** Las series concretas, si la pregunta nombra alguna (van en vez del archivo entero). */
	series: CatalogEntry[];
}

/**
 * Qué JSON mandar para una pregunta. Primero, series concretas: los atajos de G (su código o sus claves) y las del
 * catálogo por las palabras de su nombre, con el país de la pregunta delante («paro en Alemania» → el alemán, no el
 * español). Luego, temas con los códigos (en mayúsculas), nombres y alias de los comandos de la barra. Como mucho 4.
 */
export function pickData(question: string, catalog: CatalogEntry[]): DataPick {
	const text = plain(question);
	const words = new Set(text.trim().split(' '));
	const asked = countriesIn(text);

	// 1. Series: 2 puntos por el código o una clave de su atajo y 1 por cada palabra de su nombre (sin contar el
	//    país). Si no tiene país o es el que se pregunta: +1 si están todas y +1 si es un atajo de G. −3 por cada
	//    cifra que no cuadra («1 mes» si se pregunta por «10 años»), y +2 si es del país que se pregunta o −3 si es
	//    de otro. Valen las que llegan a 2.
	const shortcut = new Map<string, number>();
	for (const s of SHORTCUTS) {
		// Las claves que son un país («alemania» → BUND) no valen aquí: «paro en Alemania» no va de bonos.
		const keys = (s.keys ?? []).filter((k) => !countryWords.has(plain(k).trim()));
		if (hasWord(text, s.code) || keys.some((k) => hasWord(text, k))) shortcut.set(s.id, 2);
	}
	const names = new Map(SHORTCUTS.map((s) => [s.id, s.name]));
	const numbers = [...words].some((w) => /^\d+$/.test(w));
	const ranked = catalog
		.flatMap((c, i) => {
			const name = names.get(c.id) ?? `${c.label} ${countryName(c.geo)}`;
			const sig = keyWords(name).filter((w) => !countryWords.has(w));
			const n = sig.filter((w) => words.has(w)).length;
			let score = (shortcut.get(c.id) ?? 0) + n;
			if (!score) return [];
			const country = c.geo ?? [...countriesIn(plain(name))][0];
			const fits = !country || asked.has(country);
			if (fits && n === sig.length) score += 1;
			// Los atajos de G son las series que más se piden: en caso de duda, delante.
			if (fits && n && names.has(c.id)) score += 1;
			if (numbers) score -= 3 * sig.filter((w) => /^\d+$/.test(w) && !words.has(w)).length;
			if (asked.size && country) score += asked.has(country) ? 2 : -3;
			return score >= 2 ? [{ c, i, score }] : [];
		})
		.sort((a, b) => b.score - a.score || a.i - b.i);
	const chosen = ranked.slice(0, ASK_LIMITS.series).map((x) => x.c);
	const score = new Map<string, number>();
	const add = (ds: string, n: number) => score.set(ds, (score.get(ds) ?? 0) + n);
	for (const c of chosen) add(c.ds, 3);

	// 2. Temas, con el código (en mayúsculas), el nombre y los alias de los comandos de la barra.
	for (const t of TOPICS) {
		let n = 0;
		const code = t.cmd?.code ?? '';
		if (code.length > 1 && new RegExp(`(^|[^\\p{L}])${code}([^\\p{L}]|$)`, 'u').test(question)) n = 3;
		// Un país («España», el nombre de ES) no elige un tema: «el diésel en España» va de gasolina.
		else if (t.cmd && [t.cmd.key, ...(t.cmd.aliases ?? [])].some((w) => !countryWords.has(plain(w).trim()) && hasWord(text, w))) n = 2;
		else if (t.words?.some((w) => hasWord(text, w))) n = 1;
		if (n) t.ds.forEach((ds, i) => add(ds, n - i * 0.1));
	}

	const ds = [...score.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, ASK_LIMITS.datasets)
		.map(([name]) => name);
	return { ds, series: chosen.filter((c) => ds.includes(c.ds)) };
}

// ---------- Recortar los datos ----------

/** Claves que no aportan nada para responder (enlaces, ids, coordenadas) y gastan contexto. */
const DROP = new Set(['url', 'link', 'links', 'href', 'k', 'id', 'lat', 'lon', 'icon', 'image', 'img', 'feeds', 'first', 'lang', 'guid', 'hash']);

interface Level {
	items: number;
	text: number;
}
const LEVELS: Level[] = [
	{ items: 12, text: 200 },
	{ items: 8, text: 140 },
	{ items: 5, text: 100 },
	{ items: 3, text: 80 },
	{ items: 2, text: 60 }
];

const dateOf = (v: unknown) => {
	const o = v as { t?: unknown; date?: unknown; time?: unknown } | null;
	const d = o && typeof o === 'object' ? (o.t ?? o.date ?? o.time) : null;
	return typeof d === 'string' ? d : null;
};

interface Shrink {
	level: Level;
	/** Palabras de la pregunta (con un espacio a cada lado), para poner delante lo que las nombra. */
	words: string[];
	/** Ahora, en ms: una serie que llega al futuro (la luz de mañana, una previsión) se recorta alrededor de ahora. */
	now: number;
	/** Lo de cada lista que no cambia de un nivel a otro (orden, extremos, resumen por día): se calcula una sola vez, porque el tiempo de CPU cuenta. */
	memo: WeakMap<unknown[], Memo>;
}

interface Memo {
	order?: unknown[];
	/** En una serie, el primer punto de ahora en adelante (−1 si ya ha pasado entera). */
	at?: number;
	best?: Map<string, Extreme>;
	days?: Day[] | null;
}

/** El valor más bajo y el más alto de un campo numérico de una lista, con el elemento que lo tiene. */
interface Extreme {
	lo: number;
	loAt: unknown;
	hi: number;
	hiAt: unknown;
}

/** Un día de una serie de varios puntos al día (la luz cada 15 minutos): el más bajo, el más alto y la media. */
interface Day {
	dia: string;
	puntos: number;
	min: { t: string; v: number };
	max: { t: string; v: number };
	media: number;
	/** La hora del último punto, en ms (no se manda): para saber si el día ya ha acabado. */
	end: number;
}

const round = (v: number) => (Number.isInteger(v) ? v : Math.round(v * 1e4) / 1e4);

const memoOf = (v: unknown[], s: Shrink) => s.memo.get(v) ?? s.memo.set(v, {}).get(v)!;

/** Una serie: lista con fecha (t, date o time) y de vieja a nueva. */
const isSeries = (v: unknown[]) => {
	const first = dateOf(v[0]);
	const last = dateOf(v.at(-1));
	return !!first && !!last && first < last;
};

/** De una serie, los `n` puntos alrededor de ahora: los últimos si ya ha pasado entera; los primeros si es toda futura. */
function around(v: unknown[], s: Shrink, n: number): unknown[] {
	const memo = memoOf(v, s);
	const at = (memo.at ??= v.findIndex((x) => Date.parse(dateOf(x) ?? '') >= s.now));
	const start = at < 0 ? v.length - n : Math.max(0, Math.min(at - Math.floor(n / 2), v.length - n));
	return v.slice(start, start + n);
}

/** Una lista que no es una serie, con lo que nombra la pregunta primero. */
function ordered(v: unknown[], s: Shrink): unknown[] {
	const memo = memoOf(v, s);
	if (memo.order) return memo.order;
	let list = v;
	if (s.words.length) {
		// Las palabras que distinguen (las que salen en menos de la mitad: «madrid» sí, «diesel» no) suben lo que las nombra.
		// Sin la expresión regular de plain(): aquí se recorre todo el archivo y el tiempo de CPU cuenta.
		const texts = v.map((x) => fold(JSON.stringify(x) ?? ''));
		const useful = s.words.filter((w) => {
			const n = texts.filter((t) => t.includes(w)).length;
			return n > 0 && n <= v.length / 2;
		});
		const hits = texts.map((t) => useful.filter((w) => t.includes(w)).length);
		list = v.map((x, i) => ({ x, i })).sort((a, b) => hits[b.i] - hits[a.i] || a.i - b.i).map(({ x }) => x);
	}
	return (memo.order = list);
}

/** Por días, si la serie tiene varios puntos al día con un valor `v` (la luz, una previsión por horas); si no, null. */
function perDay(v: unknown[]): Day[] | null {
	const byDay = new Map<string, { t: string; v: number }[]>();
	for (const x of v) {
		const t = dateOf(x);
		const value = (x as { v?: unknown }).v;
		if (!t || t.length <= 10 || typeof value !== 'number') return null;
		const day = t.slice(0, 10);
		(byDay.get(day) ?? byDay.set(day, []).get(day)!).push({ t, v: value });
	}
	if (byDay.size === v.length) return null;
	return [...byDay].map(([dia, points]) => ({
		dia,
		puntos: points.length,
		min: points.reduce((a, b) => (b.v < a.v ? b : a)),
		max: points.reduce((a, b) => (b.v > a.v ? b : a)),
		media: round(points.reduce((a, b) => a + b.v, 0) / points.length),
		end: Date.parse(points.at(-1)!.t)
	}));
}

/** Cada campo numérico de una lista de objetos (hasta un nivel dentro: «avg.diesel»), con su elemento más bajo y su más alto. */
function extremes(v: unknown[]): Map<string, Extreme> {
	const best = new Map<string, Extreme>();
	const visit = (item: unknown, o: object, path: string, depth: number) => {
		for (const [k, x] of Object.entries(o)) {
			if (DROP.has(k)) continue;
			const p = path ? `${path}.${k}` : k;
			if (typeof x === 'number' && Number.isFinite(x)) {
				const b = best.get(p);
				if (!b) best.set(p, { lo: x, loAt: item, hi: x, hiAt: item });
				else if (x < b.lo) Object.assign(b, { lo: x, loAt: item });
				else if (x > b.hi) Object.assign(b, { hi: x, hiAt: item });
			} else if (!depth && x && typeof x === 'object' && !Array.isArray(x)) visit(item, x, p, 1);
		}
	};
	for (const item of v) if (item && typeof item === 'object' && !Array.isArray(item)) visit(item, item, '', 0);
	// Un campo que vale lo mismo en todos no dice nada.
	for (const [p, b] of best) if (b.lo === b.hi) best.delete(p);
	return best;
}

const NAME_KEYS = ['name', 'label', 'title', 'place', 'serie', 'country', 'code'];

/** Cómo se nombra un elemento en «extremos»: su nombre y su fecha («Madrid», «Kuril Islands · 2026-10-19T21:43»). */
function nameOf(item: unknown, s: Shrink): string {
	const o = item as Record<string, unknown>;
	const name = NAME_KEYS.map((k) => o[k]).find((x) => typeof x === 'string');
	return shrink([name, dateOf(o)].filter(Boolean).join(' · ') || '?', s, 0) as string;
}

/**
 * Lo que va al final de una lista recortada: cuántos elementos se ven de cuántos y, calculado con TODOS, el resumen
 * por día de una serie de varios puntos al día o los extremos de cada campo numérico. Así el modelo sabe que no lo ve
 * todo y aún puede responder «el mayor», «el más barato» o «a qué hora».
 */
function cutNote(v: unknown[], shown: number, s: Shrink): Record<string, unknown> {
	const note: Record<string, unknown> = { recorte: `se ven ${shown} de ${v.length}` };
	const memo = memoOf(v, s);
	if (memo.days === undefined) memo.days = isSeries(v) ? perDay(v) : null;
	if (memo.days) {
		// Los días que aún no han acabado (hoy, mañana…) o, si ya pasaron todos, los últimos.
		const n = Math.ceil(s.level.items / 4);
		const open = memo.days.findIndex((d) => d.end >= s.now);
		const start = open < 0 ? Math.max(0, memo.days.length - n) : open;
		note.por_dia = memo.days.slice(start, start + n).map(({ end: _, min, max, ...d }) => ({
			...d,
			min: { t: min.t, v: round(min.v) },
			max: { t: max.t, v: round(max.v) }
		}));
		return note;
	}
	memo.best ??= extremes(v);
	if (!memo.best.size) return note;
	// Primero los campos que nombra la pregunta («diésel» → avg.diesel); como mucho, tantos como elementos se ven.
	const named = (p: string) => (s.words.some((w) => p.toLowerCase().includes(w)) ? 1 : 0);
	const paths = [...memo.best.keys()].sort((a, b) => named(b) - named(a)).slice(0, s.level.items);
	note.extremos = Object.fromEntries(
		paths.map((p) => {
			const b = memo.best!.get(p)!;
			return [p, { menor: { v: round(b.lo), de: nameOf(b.loAt, s) }, mayor: { v: round(b.hi), de: nameOf(b.hiAt, s) } }];
		})
	);
	return note;
}

function shrink(v: unknown, s: Shrink, depth: number): unknown {
	if (typeof v === 'number') return round(v);
	if (typeof v === 'string') return v.length > s.level.text ? `${v.slice(0, s.level.text)}…` : v;
	if (v === null || typeof v !== 'object') return v;
	if (depth > 6) return undefined;
	if (Array.isArray(v)) {
		const n = s.level.items;
		if (v.length <= n) return v.map((x) => shrink(x, s, depth + 1));
		// Las series, alrededor de ahora (y en su orden); el resto, lo que nombra la pregunta primero.
		const kept = isSeries(v) ? around(v, s, n) : ordered(v, s).slice(0, n);
		return [...kept.map((x) => shrink(x, s, depth + 1)), cutNote(v, kept.length, s)];
	}
	const out: Record<string, unknown> = {};
	for (const [k, x] of Object.entries(v)) {
		if (DROP.has(k)) continue;
		const y = shrink(x, s, depth + 1);
		if (y !== undefined) out[k] = y;
	}
	return out;
}

/**
 * El JSON de `data` en `budget` caracteres como mucho: menos elementos y textos más cortos hasta que quepa. Una lista
 * recortada acaba en { recorte: «se ven 12 de 80», extremos | por_dia } (ver cutNote).
 */
export function compact(data: unknown, budget: number, question = '', now = Date.now()): string {
	const words = plain(question)
		.trim()
		.split(' ')
		.filter((w) => w.length >= 4 && !STOP.has(w));
	const memo = new WeakMap<unknown[], Memo>();
	let text = '';
	for (const level of LEVELS) {
		text = JSON.stringify(shrink(data, { level, words, now, memo }, 0)) ?? '';
		if (text.length <= budget) return text;
	}
	// Ni así: se corta en la última coma que cabe (sin partir una cifra por la mitad).
	const cut = text.slice(0, budget);
	return `${cut.slice(0, Math.max(0, cut.lastIndexOf(',')))}…`;
}

// ---------- Comprobar las cifras ----------

/** Una cifra escrita y cómo puede leerse (con «1.234» no se sabe si es mil doscientos o uno coma dos). */
export interface Figure {
	raw: string;
	/** Valor sin signo (ya multiplicado si va «mil», «millones»…) y cuánto puede haberse redondeado. */
	readings: { v: number; tol: number }[];
}

const SCALES: [RegExp, number][] = [
	[/^\s*mil\s+millones\b/i, 1e9],
	[/^\s*billon(es)?\b/i, 1e12],
	[/^\s*millon(es)?\b/i, 1e6],
	[/^\s*mil\b/i, 1e3]
];

/** Las cifras de un texto, en español o en inglés: «1.234,5», «2,35 %», «0.5», «2026», «1,2 millones». */
export function figures(text: string): Figure[] {
	const folded = text.normalize('NFD').replace(/\p{M}/gu, '');
	const out: Figure[] = [];
	for (const m of folded.matchAll(/\d+(?:[.,]\d+)*/g)) {
		const raw = m[0];
		const after = folded.slice(m.index + raw.length, m.index + raw.length + 16);
		const scale = SCALES.find(([re]) => re.test(after))?.[1] ?? 1;
		const readings: Figure['readings'] = [];
		/** `dec`: el separador decimal (null si no hay); los demás separadores son de miles. */
		const read = (dec: string | null) => {
			const at = dec ? raw.lastIndexOf(dec) : -1;
			const int = (at < 0 ? raw : raw.slice(0, at)).replace(/[.,]/g, '');
			const frac = at < 0 ? '' : raw.slice(at + 1);
			const v = Number(`${int}.${frac || '0'}`) * scale;
			if (Number.isFinite(v)) readings.push({ v, tol: 0.5 * 10 ** -frac.length * scale });
		};
		const dots = raw.split('.').length - 1;
		const commas = raw.split(',').length - 1;
		if (dots && commas) read(raw.lastIndexOf(',') > raw.lastIndexOf('.') ? ',' : '.');
		else if (dots + commas !== 1) read(null);
		else {
			const sep = dots ? '.' : ',';
			read(sep);
			// Un solo separador con tres cifras detrás: también puede ser de miles («1.234» en español).
			if (raw.length - raw.indexOf(sep) - 1 === 3) read(null);
		}
		out.push({ raw, readings });
	}
	return out;
}

/** Las cifras de la respuesta que NO están en el contexto ni en la pregunta (admite que las redondee). */
export function unsupported(answer: string, context: string, question = ''): string[] {
	const known = [...new Set(figures(`${context}\n${question}`).flatMap((f) => f.readings.map((r) => r.v)))];
	return figures(answer)
		.filter((f) => !f.readings.some((r) => known.some((c) => Math.abs(c - r.v) <= r.tol + 1e-9 * Math.max(1, r.v))))
		.map((f) => f.raw);
}

/** El texto de la respuesta del modelo: los de antes dan { response }; los nuevos, como OpenAI (choices). */
export function answerOf(out: unknown): string {
	const o = out as { response?: unknown; choices?: { message?: { content?: unknown } }[] } | null;
	const raw = typeof o?.response === 'string' ? o.response : o?.choices?.[0]?.message?.content;
	if (typeof raw !== 'string') return '';
	return raw
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/[*_#`]+/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, ASK_LIMITS.answer);
}

// ---------- La Function ----------

/** La fecha y la hora de ahora en Madrid, con la UTC al lado: así «hoy», «mañana» o «a qué hora» tienen referencia. */
export function nowLine(now: number): string {
	const madrid = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'short' }).format(now);
	return `AHORA: ${madrid}, hora de Madrid (${new Date(now).toISOString().slice(0, 16)} UTC).`;
}

/** Lo que se le dice al modelo antes de la pregunta: la hora, las reglas y los datos de hoy. */
export function systemPrompt(context: string, now = Date.now()): string {
	return [
		'Eres «Pregunta a Arc», el asistente de Arc Terminal. Respondes en español, en una a cuatro frases claras.',
		nowLine(now),
		'Reglas:',
		'- Usa SOLO los DATOS DE HOY de abajo. No uses lo que sepas por tu cuenta y no inventes nada.',
		'- Copia las cifras tal como salen en los datos (puedes redondearlas), con su unidad y su fecha si la tienen.',
		`- Si los datos no bastan para responder, contesta exactamente: «${NO_SE}»`,
		'- Los datos van recortados. Una lista que acaba en {"recorte":"se ven 12 de 80",…} solo enseña 12 de sus 80 elementos, y un bloque que acaba en «…» está cortado.',
		`- De una lista recortada no digas cuál es el mayor, el menor, el más caro, el más barato, el primero ni el último, salvo con sus «extremos» o su «por_dia», que se calculan con todos los elementos. Si no salen ahí, contesta exactamente: «${NO_SE}»`,
		'- No des consejos de inversión ni recomiendes comprar o vender.',
		'- Texto normal: sin Markdown y sin listas.',
		'DATOS DE HOY (JSON recortado; cada bloque dice de qué fuente es y cuándo se descargó):',
		context
	].join('\n');
}

const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Caché de los JSON de static/data en este isolate: cambian como mucho cada 5 minutos (fast.yml). */
const cache = new Map<string, { at: number; value: unknown }>();
const CACHE_MS = 5 * 60 * 1000;
export const clearAskCache = () => cache.clear();

async function readData(assets: Assets, origin: string, path: string): Promise<unknown> {
	const hit = cache.get(path);
	if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;
	const res = await assets.fetch(new URL(path, origin).href);
	const value: unknown = res.ok ? await res.json().catch(() => null) : null;
	if (cache.size >= 40) cache.delete(cache.keys().next().value!);
	cache.set(path, { at: Date.now(), value });
	return value;
}

interface DataFile {
	fetchedAt?: unknown;
	data?: unknown;
}

/**
 * Lo que sobra de algunos archivos antes de recortarlos. fuel-es: en su historial, cada día lleva las 52 provincias
 * por id (sin nombre: el id no se manda), unos 4 KB por día que no dejaban sitio a las provincias de hoy. La media de
 * España de cada día sí se queda.
 */
const PREPARE: Record<string, (data: unknown) => unknown> = {
	'fuel-es': (data) => {
		const d = data as { history?: unknown };
		if (!d || typeof d !== 'object' || !Array.isArray(d.history)) return data;
		return { ...d, history: d.history.map((day: unknown) => (day && typeof day === 'object' ? { ...day, provinces: undefined } : day)) };
	}
};

/** El contexto de una pregunta y sus fuentes: un bloque por archivo, con su hora, en ~8 KB entre todos. */
export async function buildContext(
	question: string,
	pick: DataPick,
	load: (path: string) => Promise<unknown>,
	now = Date.now()
): Promise<{ context: string; sources: Source[] }> {
	const status = (await load('/data/status.json')) as { data?: { name: string; label?: string }[] } | null;
	const labels = new Map((Array.isArray(status?.data) ? status.data : []).map((s) => [s.name, s.label ?? s.name]));
	const files = await Promise.all(pick.ds.map(async (name) => ({ name, file: (await load(`/data/${name}.json`)) as DataFile | null })));
	const ready = files.flatMap(({ name, file }) =>
		file && file.data != null && typeof file.fetchedAt === 'string' ? [{ name, data: file.data, fetchedAt: file.fetchedAt }] : []
	);
	const budget = Math.floor(ASK_LIMITS.context / Math.max(1, ready.length));
	const blocks: string[] = [];
	const sources: Source[] = [];
	for (const { name, data, fetchedAt } of ready) {
		const label = labels.get(name) ?? name;
		const series = pick.series.filter((c) => c.ds === name);
		// Si la pregunta nombra series concretas, van esas en vez del archivo entero (compact las recorta alrededor de
		// ahora y deja sus extremos, calculados con todos los puntos).
		const content = series.length
			? series.map((c) => ({ serie: c.label, unidad: c.unit, zona: c.geo, puntos: extract(data, c) }))
			: (PREPARE[name]?.(data) ?? data);
		blocks.push(`[${label} · datos del ${fetchedAt}]\n${compact(content, budget, question, now)}`);
		sources.push({ name, label, fetchedAt });
	}
	return { context: blocks.join('\n\n'), sources };
}

/** La pregunta limpia (una línea, sin caracteres de control), o el error con su código. */
export function parseQuestion(body: unknown): string | { status: number; error: string } {
	const q = (body as { q?: unknown } | null)?.q;
	if (typeof q !== 'string') return { status: 400, error: 'falta q' };
	const clean = q.replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/g, ' ').trim();
	if (!clean) return { status: 400, error: 'pregunta vacía' };
	if (clean.length > ASK_LIMITS.question) return { status: 413, error: `máximo ${ASK_LIMITS.question} caracteres` };
	return clean;
}

export async function handleAsk(
	request: Request,
	env: AskEnv,
	store: AskStore | null,
	fetcher?: (url: string) => Promise<Response>,
	now = Date.now()
): Promise<Response> {
	const { AI: model, ASSETS: assets } = env;
	if (!store || !model || !assets) return json(503, { error: 'sin configurar' });
	// Sin Access, desde otra web, sin identificar o un token de servicio: fuera (access.ts).
	const who = await person(request, env, fetcher);
	if (who instanceof Response) return who;
	const user = who.email;
	const day = dayOf(now);
	const limit = ASK_LIMITS.perDay;

	if (request.method === 'GET') return json(200, { used: await store.used(user, day), limit, model: MODEL });
	if (request.method !== 'POST') return json(405, { error: 'método' });

	if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json')
		return json(415, { error: 'solo JSON' });
	const raw = await request.text();
	if (raw.length > ASK_LIMITS.body) return json(413, { error: 'demasiado grande' });
	let body: unknown;
	try {
		body = JSON.parse(raw);
	} catch {
		return json(400, { error: 'JSON no válido' });
	}
	const question = parseQuestion(body);
	if (typeof question !== 'string') return json(question.status, { error: question.error });

	const origin = new URL(request.url).origin;
	const load = (path: string) => readData(assets, origin, path);
	const catalog = (await load('/data/g/series.json')) as { data?: unknown } | null;
	const pick = pickData(question, Array.isArray(catalog?.data) ? (catalog.data as CatalogEntry[]) : []);
	const { context, sources } = await buildContext(question, pick, load, now);
	// Ningún dato de hoy trata de eso: ni se gasta IA ni cuenta para el tope.
	if (!sources.length) return json(200, { answer: NO_SE, sources: [], used: await store.used(user, day), limit });

	if (!(await store.take(user, day, limit))) return json(429, { error: 'tope diario', used: limit, limit });
	let answer: string;
	try {
		answer = answerOf(
			await model.run(MODEL, {
				messages: [
					{ role: 'system', content: systemPrompt(context, now) },
					{ role: 'user', content: question }
				],
				max_completion_tokens: ASK_LIMITS.tokens,
				temperature: 0.2,
				// Sin «pensar en voz alta»: más rápido, más barato y la respuesta sale entera en content.
				chat_template_kwargs: { enable_thinking: false }
			})
		);
	} catch {
		// Cuota de Workers AI agotada o el modelo no responde: esa pregunta no cuenta.
		await store.settle(user, day, 'failed');
		return json(503, { error: 'la IA no responde' });
	}
	// La fecha y la hora de ahora también valen («hoy, 20 de octubre, a las 17:00»).
	const bad = answer ? unsupported(answer, `${nowLine(now)}\n${context}`, question) : [];
	if (bad.length) await store.settle(user, day, 'rejected');
	const used = await store.used(user, day);
	if (!answer || bad.length || plain(answer).includes(' no lo se '))
		return json(200, { answer: NO_SE, sources, rejected: bad.length > 0, used, limit });
	return json(200, { answer, sources, used, limit });
}

/** D1: tabla ask_count, una fila por persona y día con cuántas lleva. Se crea sola (cloud/schema.ts). */
export function d1AskStore(db: D1Database): AskStore {
	const ready = () => ensure(db, 'ask_count');
	return {
		async used(user, day) {
			await ready();
			const { results } = await db
				.prepare('SELECT n FROM ask_count WHERE user = ? AND day = ?')
				.bind(user, day)
				.all<{ n: number }>();
			return results[0]?.n ?? 0;
		},
		async take(user, day, limit) {
			await ready();
			// De paso, fuera lo de hace más de un mes: solo sirve para medir el uso.
			const old = dayOf(Date.parse(`${day}T00:00:00Z`) - ASK_LIMITS.keepDays * 86_400_000);
			await db.prepare('DELETE FROM ask_count WHERE day < ?').bind(old).run();
			// En una sola sentencia: dos preguntas a la vez no se saltan el tope.
			const { results } = await db
				.prepare(
					'INSERT INTO ask_count (user, day, n, rejected) VALUES (?, ?, 1, 0) ON CONFLICT (user, day) DO UPDATE SET n = n + 1 WHERE n < ? RETURNING n'
				)
				.bind(user, day, limit)
				.all<{ n: number }>();
			return results.length > 0;
		},
		async settle(user, day, outcome) {
			if (outcome === 'ok') return;
			await ready();
			const sql =
				outcome === 'failed'
					? 'UPDATE ask_count SET n = MAX(n - 1, 0) WHERE user = ? AND day = ?'
					: 'UPDATE ask_count SET rejected = rejected + 1 WHERE user = ? AND day = ?';
			await db.prepare(sql).bind(user, day).run();
		}
	};
}

/** En memoria, para los tests. */
export function memoryAskStore(): AskStore & { rows: Map<string, { n: number; rejected: number }> } {
	const rows = new Map<string, { n: number; rejected: number }>();
	const key = (user: string, day: string) => `${user}|${day}`;
	return {
		rows,
		used: async (user, day) => rows.get(key(user, day))?.n ?? 0,
		async take(user, day, limit) {
			const row = rows.get(key(user, day)) ?? { n: 0, rejected: 0 };
			if (row.n >= limit) return false;
			rows.set(key(user, day), { ...row, n: row.n + 1 });
			return true;
		},
		async settle(user, day, outcome) {
			const row = rows.get(key(user, day));
			if (!row || outcome === 'ok') return;
			if (outcome === 'failed') row.n = Math.max(0, row.n - 1);
			else row.rejected++;
		}
	};
}

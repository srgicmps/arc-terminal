// Avisos al móvil por usuario: qué elige cada uno en AVISOS. Lo comparten la vista (src/routes/avisos), el
// servidor (cloud/alerts.ts, que lo guarda en D1) y la Action (scripts/alerts/users.ts, que reparte los avisos).
// Lógica pura, sin depender del navegador ni de Node.
import { cleanWord, LIMITS, parseAlert, alertText, type UserAlert } from './useralerts.ts';

/** Grupos de avisos, con los tipos de regla de scripts/alerts/rules.ts y world.ts que caen en cada uno. */
export const GROUPS = [
	{ id: 'imp', label: 'Lo más importante', types: ['imp'] },
	{ id: 'conflictos', label: 'Guerras y geopolítica', types: ['war', 'conflict', 'strait', 'election', 'poly'] },
	{ id: 'desastres', label: 'Terremotos y catástrofes', types: ['quake', 'gdacs', 'blackout', 'ioda', 'who'] },
	{
		id: 'mercados',
		label: 'Mercados y valores',
		types: ['market', 'vix', 'auction', 'stock', 'hy', 'liquidity', 'earnings', 'session']
	},
	{ id: 'macro', label: 'Macro y bancos centrales', types: ['rate', 'macro', 'eia', 'fedreg'] },
	{ id: 'tech', label: 'IA y tecnología', types: ['ai', 'launch', 'status'] },
	{ id: 'energia', label: 'Diésel, gas y luz', types: ['gas', 'diesel-day', 'diesel-extreme', 'diesel-gap', 'luz'] },
	{ id: 'resumenes', label: 'Resúmenes (mañana, noche, semana)', types: ['morning', 'evening', 'week'] },
	{ id: 'agenda', label: 'Agenda y otros', types: ['tomorrow', 'dst', 'down'] }
] as const;

export type GroupId = (typeof GROUPS)[number]['id'];

/** El grupo de un tipo de regla. Los que no están en la tabla van a «Agenda y otros». */
export const groupOf = (type: string): GroupId =>
	GROUPS.find((g) => (g.types as readonly string[]).includes(type))?.id ?? 'agenda';

/** Tipos que no se reparten por grupos: las alertas y palabras propias de cada uno (users.ts) y el saludo. */
export const OWNER_ONLY = ['user-alert', 'vigila', 'hello', 'casa'];

export interface AlertConfig {
	/** Avisos activados. */
	on: boolean;
	groups: GroupId[];
	/** Hasta qué nivel llegan: 1 solo urgentes … 4 todo, resúmenes incluidos. */
	level: 1 | 2 | 3 | 4;
	/** Tope de avisos al día (día de Madrid). */
	daily: number;
	/** Valores propios (símbolos de EE. UU., como en MIS: «NVDA»). */
	mis: string[];
	/** También los valores que sigue Sergi (defensa, grandes de EE. UU.…). */
	baseStocks: boolean;
	/** Silencio (hora de Madrid, «23:00»–«07:30»): solo llegan los urgentes (P1). null: sin silencio. */
	quiet: { from: string; until: string } | null;
	/** «Tu mañana»: un resumen personal al día, a su hora (de Madrid), por ntfy y, si lo pide, por email. */
	brief: Brief;
	/** Alertas de precio propias («alerta NVDA > 150» en la barra): saltan una vez y se borran solas. */
	prices: PriceAlert[];
	/** Palabras vigiladas («vigila aranceles»): titulares y BOE que las nombran. */
	words: string[];
	/** Avisos de casa (F16) y de sus resultados (F12): cada uno lo enciende en AVISOS. */
	home: Home;
}

export interface Home {
	/** Las horas baratas de la luz de mañana (PVPC), al publicarse por la noche. */
	luz: boolean;
	/** Polen moderado o alto mañana en su sitio (el de «Tu mañana»). */
	pollen: boolean;
	/** La víspera de los resultados de sus valores. */
	results: boolean;
	/** Su gasolinera favorita (la de FUEL): aviso cuando baja. null: sin aviso. */
	fuel: HomeFuel | null;
}

export interface HomeFuel {
	/** Zona de FUEL: «menorca» o el id de la provincia («07»). */
	zone: string;
	id: string;
	name: string;
	kind: 'g95' | 'diesel';
}

export const DEFAULT_HOME: Home = { luz: false, pollen: false, results: false, fuel: null };

export function parseHomeFuel(raw: unknown): HomeFuel | null {
	const f = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
	if (!f || typeof f.zone !== 'string' || !/^(menorca|\d{2})$/.test(f.zone)) return null;
	if (typeof f.id !== 'string' || !/^[\w-]{1,20}$/.test(f.id)) return null;
	const name = typeof f.name === 'string' ? f.name.replace(/[\p{Cc}\s]+/gu, ' ').trim().slice(0, 60) : '';
	return { zone: f.zone, id: f.id, name: name || 'Tu gasolinera', kind: f.kind === 'diesel' ? 'diesel' : 'g95' };
}

export function parseHome(raw: unknown): Home {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	return { luz: o.luz === true, pollen: o.pollen === true, results: o.results === true, fuel: parseHomeFuel(o.fuel) };
}

/** Una alerta de precio con su id aleatorio (8 hex): así la Action la borra al avisar. */
export type PriceAlert = UserAlert & { id: string };

const PRICE_ID = /^[0-9a-f]{8}$/;

/** Una alerta de precio comprobada: se vuelve a leer desde su texto, así no entra nada raro. */
export function parsePrice(raw: unknown): PriceAlert | null {
	const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
	if (typeof o.id !== 'string' || !PRICE_ID.test(o.id)) return null;
	if (typeof o.asset !== 'string' || typeof o.op !== 'string' || typeof o.value !== 'number') return null;
	// El texto que lee parseAlert: el símbolo (o el nombre corto de BTC, ETH, diésel) y la condición.
	const sym = o.asset.startsWith('coin:') ? o.asset.slice(5) : o.asset;
	const text = o.op === '%' ? `${sym} ${o.value}%` : `${sym} ${o.op} ${o.value}`;
	const a = parseAlert(text.replace('bitcoin', 'BTC').replace('ethereum', 'ETH'));
	return a && a.asset === o.asset ? { ...a, id: o.id } : null;
}

/** Una alerta nueva de lo que se escribe en la barra, con su id. */
export const newPrice = (a: UserAlert): PriceAlert => ({
	...a,
	id: [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, '0')).join('')
});

/** Las alertas de una lista, sin repetir (misma condición) y con tope. */
export function parsePrices(raw: unknown): PriceAlert[] {
	if (!Array.isArray(raw)) return [];
	const out: PriceAlert[] = [];
	for (const r of raw) {
		const p = parsePrice(r);
		if (p && !out.some((x) => x.id === p.id || alertText(x) === alertText(p))) out.push(p);
	}
	return out.slice(0, LIMITS.alerts);
}

/** Palabras vigiladas limpias, sin repetir (sin mirar mayúsculas) y con tope. */
export function parseWordList(raw: unknown): string[] {
	if (!Array.isArray(raw)) return [];
	const words = raw.flatMap((w) => (typeof w === 'string' ? [cleanWord(w)] : [])).filter((w): w is string => !!w);
	return [...new Map(words.map((w) => [w.toLowerCase(), w])).values()].slice(0, LIMITS.words);
}

export interface Brief {
	on: boolean;
	/** Hora de Madrid, «hh:mm», de BRIEF_HOURS. */
	at: string;
	/** También por email (a su cuenta; lo manda la web con Brevo, el email nunca sale de Cloudflare). */
	email: boolean;
	/** Su sitio, para el tiempo (el de LUGAR). null: sin tiempo. */
	place: { name: string; lat: number; lon: number } | null;
}

/** Horas para «Tu mañana»: de 06:00 a 11:00, cada media hora. */
export const BRIEF_HOURS = Array.from({ length: 11 }, (_, i) => `${String(6 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

export const DEFAULT_BRIEF: Brief = { on: false, at: '08:00', email: false, place: null };

/** Un «Tu mañana» comprobado; lo que no valga, por defecto. */
export function parseBrief(raw: unknown): Brief {
	const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const p = o.place as { name?: unknown; lat?: unknown; lon?: unknown } | null | undefined;
	const place =
		p &&
		typeof p.name === 'string' &&
		p.name.trim() &&
		typeof p.lat === 'number' &&
		typeof p.lon === 'number' &&
		Math.abs(p.lat) <= 90 &&
		Math.abs(p.lon) <= 180
			? { name: p.name.trim().slice(0, 60), lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100 }
			: null;
	return {
		on: o.on === true,
		at: typeof o.at === 'string' && BRIEF_HOURS.includes(o.at) ? o.at : DEFAULT_BRIEF.at,
		email: o.email === true,
		place
	};
}

export const DAILY_MAX = 100;
export const MIS_MAX = 20;

/** «El básico»: lo mismo que recibe Sergi. */
export const DEFAULT_CONFIG: AlertConfig = {
	on: false,
	groups: GROUPS.map((g) => g.id),
	level: 4,
	daily: DAILY_MAX,
	mis: [],
	baseStocks: true,
	quiet: null,
	brief: DEFAULT_BRIEF,
	prices: [],
	words: [],
	home: DEFAULT_HOME
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const SYMBOL = /^[A-Z0-9.]{1,12}$/;

/** Una configuración comprobada a partir de lo que llegue (del navegador o de la base); lo que no valga, por defecto. */
export function parseConfig(raw: unknown): AlertConfig {
	const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
	const ids = GROUPS.map((g) => g.id) as string[];
	const groups = Array.isArray(o.groups)
		? [...new Set(o.groups.filter((g): g is GroupId => typeof g === 'string' && ids.includes(g)))]
		: DEFAULT_CONFIG.groups;
	const level = [1, 2, 3, 4].includes(o.level as number) ? (o.level as AlertConfig['level']) : DEFAULT_CONFIG.level;
	const daily =
		typeof o.daily === 'number' && Number.isFinite(o.daily)
			? Math.min(DAILY_MAX, Math.max(1, Math.round(o.daily)))
			: DEFAULT_CONFIG.daily;
	const mis = Array.isArray(o.mis)
		? [...new Set(o.mis.filter((s): s is string => typeof s === 'string').map((s) => s.trim().toUpperCase()))]
				.filter((s) => SYMBOL.test(s))
				.slice(0, MIS_MAX)
		: [];
	const q = o.quiet as { from?: unknown; until?: unknown } | null | undefined;
	const quiet =
		q &&
		typeof q.from === 'string' &&
		typeof q.until === 'string' &&
		HHMM.test(q.from) &&
		HHMM.test(q.until) &&
		q.from !== q.until
			? { from: q.from, until: q.until }
			: null;
	return { on: o.on === true, groups, level, daily, mis, baseStocks: o.baseStocks !== false, quiet, brief: parseBrief(o.brief), prices: parsePrices(o.prices), words: parseWordList(o.words), home: parseHome(o.home) };
}

/** ¿Está «hh:mm» dentro del silencio? Admite silencios que cruzan la medianoche (23:00–07:00). */
export function inQuiet(hhmm: string, quiet: AlertConfig['quiet']): boolean {
	if (!quiet) return false;
	return quiet.from < quiet.until ? hhmm >= quiet.from && hhmm < quiet.until : hhmm >= quiet.from || hhmm < quiet.until;
}

/** ¿Le llega a este usuario un aviso de este tipo y nivel a esta hora (de Madrid)? */
export function wants(config: AlertConfig, type: string, level: number, hhmm: string): boolean {
	if (!config.on || OWNER_ONLY.includes(type)) return false;
	if (!config.groups.includes(groupOf(type))) return false;
	if (level > config.level) return false;
	return level === 1 || !inQuiet(hhmm, config.quiet);
}

// Bienvenida (la primera vez o desde HELP): qué te interesa → un plan con tu portada, tu vista de inicio, una
// lista de valores de ejemplo y una propuesta de avisos. Lógica pura, sin depender del navegador: recibe el
// localStorage (o uno simulado en los tests), como transfer.ts. La pantalla está en src/routes/bienvenida.
import type { GroupId } from '../alertconfig.ts';
import { collect } from '../transfer.ts';
import { readLists } from '../watchlists.ts';

export const WELCOME_KEY = 'arc-welcome';
/** Modo «sencillo» o «terminal». Lo guarda la bienvenida; lo aplica el modo sencillo (modo.svelte.ts). */
export const SIMPLE_KEY = 'arc-modo';

export type InterestId = 'bolsa' | 'eco' | 'mundo' | 'es' | 'tech' | 'hogar';

export interface Interest {
	id: InterestId;
	label: string;
	hint: string;
	/** Paneles de la portada (ids de la vista modular de TOP), de más a menos importante. */
	top: string[];
	/** Paneles fijados (pins.ts). */
	pins: string[];
	/** Temas de AVISOS. */
	alerts: GroupId[];
}

export const INTERESTS: readonly Interest[] = [
	{
		id: 'bolsa',
		label: 'Bolsa e inversión',
		hint: 'Índices, valores, tipos y divisas',
		top: ['markets', 'sessions', 'risk', 'rates', 'fx', 'agenda'],
		pins: ['pin:eco:bancos'],
		alerts: ['mercados', 'macro']
	},
	{
		id: 'eco',
		label: 'Economía',
		hint: 'Inflación, paro, bancos centrales',
		top: ['macro', 'rates', 'agenda', 'week'],
		pins: ['pin:eco:bancos'],
		alerts: ['macro']
	},
	{
		id: 'mundo',
		label: 'Noticias del mundo',
		hint: 'Lo importante, conflictos, terremotos',
		top: ['important', 'news', 'quakes', 'predictions'],
		pins: ['pin:geo:mapa'],
		alerts: ['imp', 'conflictos', 'desastres']
	},
	{ id: 'es', label: 'España', hint: 'BOE, datos y titulares', top: ['boe', 'news', 'macro'], pins: [], alerts: ['imp'] },
	{ id: 'tech', label: 'IA y tecnología', hint: 'Modelos, lanzamientos, Hacker News', top: ['hn', 'news'], pins: [], alerts: ['tech'] },
	{
		id: 'hogar',
		label: 'Ahorro y hogar',
		hint: 'Luz, gasolina, hipoteca, IPC',
		top: ['power', 'fuel', 'weather', 'macro'],
		pins: [],
		alerts: ['energia']
	}
];

/** Siempre a la vista, te interese lo que te interese. */
const ALWAYS = ['important', 'weather'];

export type ProfileId = 'inversor' | 'curioso' | 'hogar' | 'todo';

export interface Profile {
	id: ProfileId;
	label: string;
	desc: string;
	interests: InterestId[];
	/** Vista que se abre al entrar (código de comando). */
	home: string;
	/** Lista de valores de ejemplo para MIS (solo si la tuya está vacía). */
	mis: string[];
	level: 1 | 2 | 3 | 4;
	daily: number;
}

export const PROFILES: readonly Profile[] = [
	{
		id: 'inversor',
		label: 'Inversor',
		desc: 'Mercados primero: índices, tus valores, tipos y la agenda',
		interests: ['bolsa', 'eco', 'mundo'],
		home: 'TOP',
		mis: ['SPY', 'NVDA', 'AAPL', 'MSFT', 'SAN', 'ITX'],
		level: 2,
		daily: 20
	},
	{
		id: 'curioso',
		label: 'Curioso de noticias',
		desc: 'Lo más importante del día, el mundo, España y la tecnología',
		interests: ['mundo', 'es', 'tech'],
		home: 'IMP',
		mis: ['SPY', 'AAPL', 'NVDA'],
		level: 2,
		daily: 10
	},
	{
		id: 'hogar',
		label: 'Ahorro y hogar',
		desc: 'La luz más barata, la gasolina, la hipoteca y los precios',
		interests: ['hogar', 'es', 'eco'],
		home: 'TOP',
		mis: [],
		level: 1,
		daily: 5
	},
	{
		id: 'todo',
		label: 'Todo',
		desc: 'La terminal completa, sin filtros',
		interests: INTERESTS.map((i) => i.id),
		home: 'TOP',
		mis: ['SPY', 'NVDA', 'AAPL', 'MSFT', 'SAN', 'ITX', 'BTC'],
		level: 3,
		daily: 30
	}
];

export const findProfile = (id: string | null | undefined) => PROFILES.find((p) => p.id === id);

/** La propuesta de avisos: la lee AVISOS para ofrecerla («Usar la propuesta»), nunca la activa sola. */
export interface AlertSuggestion {
	groups: GroupId[];
	level: 1 | 2 | 3 | 4;
	daily: number;
	/** Solo símbolos de EE. UU. (como en AVISOS). */
	mis: string[];
}

export interface Plan {
	profile: ProfileId | null;
	interests: InterestId[];
	home: string;
	mis: string[];
	pins: string[];
	/** Portada modular: orden y ocultos (src/lib/layout.ts). */
	layout: { order: string[]; hidden: string[]; span: Record<string, 1 | 2 | 3> };
	alerts: AlertSuggestion;
	simple: boolean;
}

const uniq = <T>(xs: T[]) => [...new Set(xs)];
const US = /^[A-Z]{1,5}$/;
/** Los de la Bolsa de Madrid no cuentan para los avisos (solo EE. UU.). */
const SPAIN = new Set(['SAN', 'ITX', 'IBE', 'BBVA', 'TEF', 'BTC']);

/**
 * El plan para unos intereses (y un perfil, si se eligió uno). `modules`: los paneles de la portada que
 * existen hoy, en su orden de fábrica; lo que no esté en tus intereses se oculta (se puede volver a enseñar).
 */
export function buildPlan(interests: InterestId[], profileId: ProfileId | null, modules: readonly string[], simple: boolean): Plan {
	const profile = findProfile(profileId);
	const ids = interests.length ? interests : (profile?.interests ?? []);
	const chosen = INTERESTS.filter((i) => ids.includes(i.id));
	const list = chosen.length ? chosen : INTERESTS;
	const wanted = uniq([...ALWAYS, ...list.flatMap((i) => i.top)]).filter((id) => modules.includes(id));
	const all = list.length === INTERESTS.length;
	const order = [...wanted, ...modules.filter((id) => !wanted.includes(id))];
	const mis = profile?.mis ?? (list.some((i) => i.id === 'bolsa') ? PROFILES[0].mis : []);
	const groups = uniq<GroupId>([...list.flatMap((i) => i.alerts), 'resumenes']);
	return {
		profile: profile?.id ?? null,
		interests: list.map((i) => i.id),
		home: profile?.home ?? 'TOP',
		mis,
		pins: uniq(list.flatMap((i) => i.pins)),
		layout: { order, hidden: all ? [] : modules.filter((id) => !wanted.includes(id)), span: {} },
		alerts: {
			groups,
			level: profile?.level ?? 2,
			daily: profile?.daily ?? 10,
			mis: mis.filter((c) => US.test(c) && !SPAIN.has(c))
		},
		simple
	};
}

type Store = Pick<Storage, 'length' | 'key' | 'getItem' | 'setItem'>;

export interface Welcome {
	v: 1;
	profile: ProfileId | null;
	interests: InterestId[];
	alerts: AlertSuggestion;
	/** Cuándo se hizo (ISO). */
	at: string;
}

/**
 * Lo escribe todo en el navegador. Respeta lo que ya tengas: la lista de valores solo se rellena si está
 * vacía y los fijados se suman a los tuyos. El sitio lo pone la pantalla (setPlace), que ya lo guarda.
 */
export function applyPlan(store: Store, plan: Plan, now = new Date()) {
	store.setItem('arc-home', plan.home);
	// Con todo lo que hay, la portada de siempre; si no, la modular con lo tuyo delante y el resto oculto.
	if (plan.layout.hidden.length) {
		store.setItem('arc-mode', 'modular');
		store.setItem('arc-layout-top', JSON.stringify(plan.layout));
	}
	store.setItem(SIMPLE_KEY, plan.simple ? 'sencillo' : 'terminal');

	let pins: { id: string; span: number }[] = [];
	try {
		const saved = JSON.parse(store.getItem('arc-pins') ?? '[]');
		if (Array.isArray(saved)) pins = saved;
	} catch {}
	for (const id of plan.pins) if (!pins.some((p) => p?.id === id)) pins.push({ id, span: 1 });
	store.setItem('arc-pins', JSON.stringify(pins));

	const lists = readLists(store.getItem('arc-watchlists'), store.getItem('arc-watchlist'));
	const active = lists.lists[lists.active];
	if (plan.mis.length && !active.codes.length) {
		active.codes = [...plan.mis];
		store.setItem('arc-watchlists', JSON.stringify(lists));
	}

	const welcome: Welcome = { v: 1, profile: plan.profile, interests: plan.interests, alerts: plan.alerts, at: now.toISOString() };
	store.setItem(WELCOME_KEY, JSON.stringify(welcome));
}

/** Lo que dejó la bienvenida, o null si no se ha hecho (o está roto). */
export function readWelcome(text: string | null): Welcome | null {
	try {
		const w = JSON.parse(text ?? 'null');
		if (w?.v !== 1 || !Array.isArray(w.interests) || !Array.isArray(w.alerts?.groups)) return null;
		return w as Welcome;
	} catch {
		return null;
	}
}

/**
 * ¿Hay que enseñar la bienvenida al entrar? Solo a quien llega por primera vez: sin bienvenida hecha y sin
 * ningún ajuste ni dato suyo (quien ya usaba Arc no la ve sola; la tiene en HELP). Con un enlace compartido
 * (la URL lleva parámetros), tampoco: manda el enlace.
 */
export function needsWelcome(store: Pick<Storage, 'length' | 'key' | 'getItem'>, search: string): boolean {
	if (search) return false;
	if (store.getItem(WELCOME_KEY) !== null) return false;
	// arc-modo no cuenta: app.html lo pone solo antes de pintar, también a quien llega por primera vez.
	return Object.keys(collect(store)).every((k) => k === SIMPLE_KEY);
}

/** «Ahora no»: se apunta que ya la has visto (no vuelve a salir sola) sin cambiar nada más. */
export function skipWelcome(store: Pick<Storage, 'setItem'>, now = new Date()) {
	const welcome: Welcome = { v: 1, profile: null, interests: [], alerts: { groups: [], level: 2, daily: 10, mis: [] }, at: now.toISOString() };
	store.setItem(WELCOME_KEY, JSON.stringify(welcome));
}

// Menú Inicio de Arc OS (shell): apps por categorías, buscador, recientes y ancladas. Lógica pura sobre una
// forma mínima de app, para no depender del registro del núcleo más que en su id, nombre y código.

export const CATEGORIES = ['Mercados', 'Economía', 'Mundo', 'Casa', 'Dinero', 'Experiencias', 'Herramientas'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface StartApp {
	id: string;
	title: string;
	/** Código de la barra (ECO, NVDA…), si lo tiene. */
	code?: string;
	desc?: string;
	icon?: string;
	/** Si el núcleo ya trae su categoría, manda. */
	category?: string;
	keywords?: string[];
}

/** Categoría de cada comando de la barra; los que no salen aquí van a Herramientas. */
const BY_CODE: Record<string, Category> = {
	WS: 'Mercados', MOST: 'Mercados', EQS: 'Mercados', IMAP: 'Mercados', MIS: 'Mercados', SIG: 'Mercados', RV: 'Mercados',
	FONDOS: 'Mercados', HDS: 'Mercados', WB: 'Mercados', BTMM: 'Mercados', G: 'Mercados', SEAS: 'Mercados', CMP: 'Mercados',
	ECO: 'Economía', ECST: 'Economía', SEMANA: 'Economía', CAL: 'Economía', IMP: 'Economía', TOP: 'Economía',
	GEO: 'Mundo', PAIS: 'Mundo', LIDER: 'Mundo', ES: 'Mundo', BOE: 'Mundo', USGOV: 'Mundo', TECH: 'Mundo', AI: 'Mundo',
	PORT: 'Mundo', AGUA: 'Mundo', GLOBO: 'Mundo', NEWS: 'Mundo', WIKI: 'Mundo', RSS: 'Mundo',
	FUEL: 'Casa', LUZ: 'Casa', WX: 'Casa', VIAJE: 'Casa', AVISOS: 'Casa', CHESS: 'Casa',
	CARTERA: 'Dinero', HIPOTECA: 'Dinero',
	EXP: 'Experiencias', TV: 'Experiencias'
};

const isCategory = (c: string | undefined): c is Category => !!c && (CATEGORIES as readonly string[]).includes(c);

export function categoryOf(app: StartApp): Category {
	if (isCategory(app.category)) return app.category;
	if (app.id.startsWith('x:') || app.id.startsWith('x/')) return 'Experiencias';
	return (app.code && BY_CODE[app.code.toUpperCase()]) || 'Herramientas';
}

/** Las apps agrupadas en el orden de CATEGORIES (sin las vacías) y por nombre dentro de cada una. */
export function byCategory(apps: StartApp[]): { category: Category; apps: StartApp[] }[] {
	return CATEGORIES.map((category) => ({
		category,
		apps: apps.filter((a) => categoryOf(a) === category).sort((a, b) => a.title.localeCompare(b.title, 'es'))
	})).filter((g) => g.apps.length);
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Buscar: todas las palabras tienen que salir en el nombre, el código, la descripción o las palabras clave.
 * Primero lo que coincide con el código o empieza el nombre.
 */
export function searchApps(apps: StartApp[], query: string): StartApp[] {
	const words = fold(query).split(/\s+/).filter(Boolean);
	if (!words.length) return [];
	const rank = (a: StartApp) => {
		const q = words.join(' ');
		if (a.code && fold(a.code) === q) return 0;
		if (fold(a.title).startsWith(q)) return 1;
		return 2;
	};
	return apps
		.filter((a) => {
			const hay = fold([a.title, a.code ?? '', a.desc ?? '', ...(a.keywords ?? []), categoryOf(a)].join(' '));
			return words.every((w) => hay.includes(w));
		})
		.sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title, 'es'));
}

/** Recientes: la última abierta delante, sin repetir, hasta `max`. */
export function pushRecent(list: string[], id: string, max = 8): string[] {
	return [id, ...list.filter((x) => x !== id)].slice(0, max);
}

/** Anclar o desanclar (si ya estaba, se quita). */
export function togglePin(list: string[], id: string, max = 12): string[] {
	return list.includes(id) ? list.filter((x) => x !== id) : [...list, id].slice(0, max);
}

/** Lo guardado (JSON de ids), validado: nunca rompe por un valor raro. */
export function parseIds(raw: string | null): string[] {
	try {
		const v: unknown = JSON.parse(raw ?? '[]');
		return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length < 80).slice(0, 50) : [];
	} catch {
		return [];
	}
}

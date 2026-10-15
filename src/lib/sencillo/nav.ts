// La app Sencilla (modo Sencillo, src/routes/app): sus pestañas y qué vistas de Terminal se dejan abrir en ella.
// Con arc-modo = sencillo, las vistas profesionales (TOP, ECO, WS…) llevan a /app; las de abajo no, porque
// también tienen sentido para quien no es experto (o son de la cuenta).

export type TabId = 'inicio' | 'dinero' | 'casa' | 'mundo' | 'avisos';

export interface Tab {
	id: TabId;
	/** Ruta de SvelteKit (sin la base). */
	route: '/app' | '/app/dinero' | '/app/casa' | '/app/mundo' | '/app/avisos';
	label: string;
	/** Nombre del icono de Icon.svelte. */
	icon: 'home' | 'euro' | 'house' | 'globe' | 'bell';
}

export const TABS: readonly Tab[] = [
	{ id: 'inicio', route: '/app', label: 'Inicio', icon: 'home' },
	{ id: 'dinero', route: '/app/dinero', label: 'Tu dinero', icon: 'euro' },
	{ id: 'casa', route: '/app/casa', label: 'Tu casa', icon: 'house' },
	{ id: 'mundo', route: '/app/mundo', label: 'El mundo', icon: 'globe' },
	{ id: 'avisos', route: '/app/avisos', label: 'Avisos', icon: 'bell' }
];

/** ¿Es una ruta de la app Sencilla? (id de ruta de SvelteKit: «/app», «/app/casa»…) */
export const isAppRoute = (id: string | null | undefined): boolean => !!id && (id === '/app' || id.startsWith('/app/'));

/** Vistas de Terminal que se pueden abrir estando en Sencillo: cambiar de modo, la cuenta y la ayuda. */
export const OPEN_IN_SIMPLE = ['/modo', '/admin', '/bienvenida', '/manual', '/avisos', '/status'];

/** La pestaña de una ruta de la app (la más larga que encaja), o la de Inicio. */
export function tabOf(id: string | null | undefined): TabId {
	const hit = TABS.filter((t) => t.route !== '/app' && (id === t.route || id?.startsWith(t.route + '/')));
	return hit[0]?.id ?? 'inicio';
}

/**
 * ¿Hay que llevar a la app Sencilla? Solo en Sencillo, fuera de /app y de las vistas abiertas, y nunca en modo TV
 * (?tv=…), que es de Terminal.
 */
export function sendToApp(modo: string | undefined, routeId: string | null | undefined, search = ''): boolean {
	if (modo !== 'sencillo' || !routeId || isAppRoute(routeId)) return false;
	if (new URLSearchParams(search).has('tv')) return false;
	return !OPEN_IN_SIMPLE.some((r) => routeId === r || routeId.startsWith(r + '/'));
}

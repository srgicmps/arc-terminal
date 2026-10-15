// Deslizar entre vistas en el móvil (lote 22): lógica pura, para probarla con Vitest. El layout escucha
// los toques y decide con estas funciones.

/** Lo mínimo para que cuente: 80 px en horizontal, el doble que en vertical y en menos de 0,7 s. */
export const SWIPE = { min: 80, ratio: 2, ms: 700, edge: 24, max: 24 } as const;

/** −1: vista anterior · 1: siguiente · 0: no es un deslizamiento. */
export function swipeDirection(dx: number, dy: number, ms: number): -1 | 0 | 1 {
	if (Math.abs(dx) < SWIPE.min || Math.abs(dx) < SWIPE.ratio * Math.abs(dy) || ms > SWIPE.ms) return 0;
	return dx < 0 ? 1 : -1;
}

/** La vista de al lado en la lista, sin dar la vuelta: en la primera y la última no pasa nada. */
export function neighbour<T>(list: T[], index: number, dir: -1 | 1): T | null {
	if (index < 0) return null;
	return list[index + dir] ?? null;
}

/** El pequeño desplazamiento que acompaña al dedo mientras se desliza: una pista, no un arrastre. */
export const nudge = (dx: number) => Math.max(-SWIPE.max, Math.min(SWIPE.max, dx * 0.15));

/** ¿La ruta `id` (page.route.id) es la sección `route` o una de sus subrutas? EXP sigue marcada en /x/periodico. */
export const isOnRoute = (id: string | null, route: string) => id === route || (route !== '/' && !!id?.startsWith(`${route}/`));

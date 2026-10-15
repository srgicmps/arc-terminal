// Centro de paquetes de Arc OS: qué apps tienes «instaladas». Por defecto están todas; se guarda solo la lista de
// las que has quitado (clave arc-os-packages, un ajuste: se sincroniza con tu cuenta). Quitar una app solo la saca
// de los menús: abrirla por comando o por su ruta sigue funcionando. Lógica pura, sin Svelte, para probarla con Vitest.

export const PACKAGES_KEY = 'arc-os-packages';

export interface PackagesState {
	/** ids de app quitadas («eco», «x:zen», «calculadora»). */
	removed: string[];
}

/** El núcleo del sistema: no se puede quitar (sin ellas no se vuelve a instalar nada ni se arregla nada). */
export const ESSENTIAL: readonly string[] = [
	'paquetes',
	'ajustes',
	'archivos',
	'monitor',
	'terminal',
	'help',
	'status'
];

/** Topes: cuántas apps quitadas se guardan y cuánto mide un id. */
export const MAX_REMOVED = 400;
const MAX_ID = 64;

export const EMPTY: PackagesState = { removed: [] };

const validId = (v: unknown): v is string =>
	typeof v === 'string' && v.length > 0 && v.length <= MAX_ID && /^[a-z0-9:_-]+$/.test(v);

/** Lo guardado, validado: ids válidos, sin repetir, sin las esenciales y con tope. Cualquier otra cosa → vacío. */
export function parsePackages(raw: string | null): PackagesState {
	try {
		const v: unknown = JSON.parse(raw ?? 'null');
		if (!v || typeof v !== 'object' || !Array.isArray((v as PackagesState).removed)) return { removed: [] };
		const ids = (v as PackagesState).removed.filter(validId).filter((id) => !ESSENTIAL.includes(id));
		return { removed: [...new Set(ids)].slice(0, MAX_REMOVED) };
	} catch {
		return { removed: [] };
	}
}

export const isEssential = (id: string) => ESSENTIAL.includes(id);

export const isInstalled = (id: string, state: PackagesState) => isEssential(id) || !state.removed.includes(id);

/** Instalar: sale de la lista de quitadas. Devuelve un estado nuevo (no toca el que recibe). */
export const install = (id: string, state: PackagesState): PackagesState =>
	state.removed.includes(id) ? { removed: state.removed.filter((x) => x !== id) } : state;

/** Quitar: entra en la lista (si no es esencial, el id es válido y no se pasa del tope). */
export function remove(id: string, state: PackagesState): PackagesState {
	if (isEssential(id) || !validId(id) || state.removed.includes(id) || state.removed.length >= MAX_REMOVED)
		return state;
	return { removed: [...state.removed, id] };
}

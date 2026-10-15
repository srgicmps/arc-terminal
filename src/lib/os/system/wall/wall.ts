// Fondos de escritorio de Arc OS: qué fondos hay, cómo se guarda tu elección (uno general, otro por escritorio,
// presentación que rota y si la pantalla de bloqueo usa el mismo) y cuál toca ahora. Lógica pura, con tests.
// El estado está en wall.svelte.ts, las imágenes propias en images.ts (IndexedDB) y el dibujo en WallLayer.svelte.

/** Fondos incluidos. Todos salen de los tokens, así que tienen versión de día y de noche sin hacer nada. */
export const PRESETS = [
	{ id: 'sistema', label: 'El del aspecto', group: 'Incluidos' },
	{ id: 'estilo', label: 'El de la estética', group: 'Incluidos' },
	{ id: 'degradado', label: 'Degradado', group: 'Incluidos' },
	{ id: 'aurora', label: 'Aurora', group: 'Incluidos' },
	{ id: 'horizonte', label: 'Horizonte', group: 'Incluidos' },
	{ id: 'duna', label: 'Duna', group: 'Incluidos' },
	{ id: 'rejilla', label: 'Rejilla', group: 'Incluidos' },
	{ id: 'puntos', label: 'Puntos', group: 'Incluidos' },
	{ id: 'liso', label: 'Liso', group: 'Incluidos' },
	{ id: 'globo', label: 'El mundo ahora', group: 'Vivos', live: 'Globo con los terremotos de las últimas horas' },
	{ id: 'cielo', label: 'Tu cielo', group: 'Vivos', live: 'Color del cielo según la altura del sol en tu sitio' }
] as const;
export type PresetId = (typeof PRESETS)[number]['id'];
export const isPreset = (id: unknown): id is PresetId => PRESETS.some((p) => p.id === id);

/** Cómo se coloca una imagen propia: rellenar, ajustar, centrar o en mosaico. */
export const FITS = [
	{ value: 'cover', label: 'Rellenar' },
	{ value: 'contain', label: 'Ajustar' },
	{ value: 'center', label: 'Centrar' },
	{ value: 'tile', label: 'Mosaico' }
] as const;
export type Fit = (typeof FITS)[number]['value'];

export type WallSource =
	| { kind: 'preset'; id: PresetId }
	| { kind: 'color'; color: string }
	| { kind: 'gradient'; from: string; to: string; angle: number }
	/** `img`: clave de la imagen en IndexedDB; `x`, `y`: punto que se queda a la vista (0–100). */
	| { kind: 'image'; img: string; fit: Fit; x: number; y: number };

export interface WallConfig {
	/** El fondo de todos los escritorios que no tienen uno propio. */
	main: WallSource;
	/** Fondo propio de un escritorio virtual (por su id). */
	desks: Record<string, WallSource>;
	/** Presentación: cambia sola cada `minutes` entre `list` (si está encendida y hay dos o más). */
	show: { on: boolean; minutes: number; list: WallSource[] };
	/** La pantalla de bloqueo usa el mismo fondo que el escritorio. */
	lock: boolean;
}

export const SHOW_MINUTES = [1, 5, 15, 30, 60, 240] as const;
export const DEFAULT_SOURCE: WallSource = { kind: 'preset', id: 'sistema' };
export const defaultConfig = (main: WallSource = DEFAULT_SOURCE): WallConfig => ({ main, desks: {}, show: { on: false, minutes: 15, list: [] }, lock: true });

const HEX = /^#[0-9a-f]{6}$/i;
const clamp = (v: unknown, min: number, max: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : def);

/** Un fondo leído de lo guardado, o null si no vale. */
export function parseSource(v: unknown): WallSource | null {
	const o = v as Record<string, unknown> | null;
	if (!o || typeof o !== 'object') return null;
	if (o.kind === 'preset') return isPreset(o.id) ? { kind: 'preset', id: o.id } : null;
	if (o.kind === 'color') return typeof o.color === 'string' && HEX.test(o.color) ? { kind: 'color', color: o.color } : null;
	if (o.kind === 'gradient')
		return typeof o.from === 'string' && HEX.test(o.from) && typeof o.to === 'string' && HEX.test(o.to)
			? { kind: 'gradient', from: o.from, to: o.to, angle: clamp(o.angle, 0, 360, 160) }
			: null;
	if (o.kind === 'image')
		return typeof o.img === 'string' && /^[\w-]{1,40}$/.test(o.img)
			? { kind: 'image', img: o.img, fit: FITS.some((f) => f.value === o.fit) ? (o.fit as Fit) : 'cover', x: clamp(o.x, 0, 100, 50), y: clamp(o.y, 0, 100, 50) }
			: null;
	return null;
}

/**
 * Lo guardado (arc-os-wall). Si no hay nada, se parte del fondo que se eligiera en el Panel de control de la shell
 * (arc-os-wallpaper, uno de los incluidos), para no perderlo.
 */
export function parseConfig(raw: string | null, legacy: string | null = null): WallConfig {
	const base = defaultConfig(isPreset(legacy) ? { kind: 'preset', id: legacy } : DEFAULT_SOURCE);
	let o: Record<string, unknown>;
	try {
		o = JSON.parse(raw ?? 'null');
	} catch {
		return base;
	}
	if (!o || typeof o !== 'object') return base;
	const desks: Record<string, WallSource> = {};
	for (const [k, v] of Object.entries((o.desks as Record<string, unknown>) ?? {})) {
		const s = parseSource(v);
		if (s && /^[\w-]{1,20}$/.test(k)) desks[k] = s;
	}
	const show = (o.show ?? {}) as Record<string, unknown>;
	const list = Array.isArray(show.list) ? show.list.map(parseSource).filter((s): s is WallSource => !!s).slice(0, 20) : [];
	return {
		main: parseSource(o.main) ?? base.main,
		desks,
		show: { on: show.on === true, minutes: SHOW_MINUTES.includes(show.minutes as never) ? (show.minutes as number) : 15, list },
		lock: o.lock !== false
	};
}

/** El fondo que toca ahora en un escritorio: la presentación manda, luego el del escritorio y luego el general. */
export function currentSource(c: WallConfig, deskId: string | null, now: number): WallSource {
	if (c.show.on && c.show.list.length > 1) {
		const i = Math.floor(now / (c.show.minutes * 60_000)) % c.show.list.length;
		return c.show.list[i];
	}
	return (deskId && c.desks[deskId]) || c.main;
}

/** Mismo fondo (para marcar el elegido en la galería). */
export const sameSource = (a: WallSource, b: WallSource) => JSON.stringify(a) === JSON.stringify(b);

/** Las imágenes propias que se usan en algún sitio (las demás se pueden borrar). */
export function usedImages(c: WallConfig): Set<string> {
	const all = [c.main, ...Object.values(c.desks), ...c.show.list];
	return new Set(all.flatMap((s) => (s.kind === 'image' ? [s.img] : [])));
}

/** CSS de una imagen propia según cómo se coloca. */
export function imageCss(fit: Fit, x: number, y: number): { size: string; repeat: string; position: string } {
	const position = fit === 'center' ? 'center' : `${x}% ${y}%`;
	if (fit === 'tile') return { size: 'auto', repeat: 'repeat', position: 'top left' };
	if (fit === 'center') return { size: 'auto', repeat: 'no-repeat', position };
	return { size: fit, repeat: 'no-repeat', position };
}

/**
 * Altura del sol (grados) en `lat`, `lon` y a esa hora, con la posición del sol bajo el cénit (`sun`, de
 * subsolar en geo/globe.ts). Basta para el fondo «Tu cielo».
 */
export function sunElevation(lat: number, lon: number, sun: { lat: number; lon: number }): number {
	const r = Math.PI / 180;
	const cos = Math.sin(lat * r) * Math.sin(sun.lat * r) + Math.cos(lat * r) * Math.cos(sun.lat * r) * Math.cos((lon - sun.lon) * r);
	return Math.asin(Math.max(-1, Math.min(1, cos))) / r;
}

/** Fase del cielo según la altura del sol: noche, alba o atardecer (cerca del horizonte) y día. */
export function skyPhase(elevation: number): 'noche' | 'crepusculo' | 'dia' {
	if (elevation < -6) return 'noche';
	if (elevation < 8) return 'crepusculo';
	return 'dia';
}

/** Comprime una imagen: el lado largo como mucho `max` px. Devuelve el tamaño de destino. */
export function fitSize(w: number, h: number, max = 2560): { w: number; h: number } {
	const k = Math.min(1, max / Math.max(w, h, 1));
	return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

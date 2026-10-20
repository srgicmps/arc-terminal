// «A tu gusto» (lote 17, punto 6): color de acento y qué secciones van en la fila de arriba y en la barra
// inferior del móvil. Se guarda en este navegador; sin nada guardado, todo queda como siempre.
// El acento va en <html data-accent> (lo pone ya src/app.html antes de pintar, para que no parpadee) y
// tokens.css redefine --amber y compañía: ningún componente sabe de qué color es el acento.
import { ACCENTS, cleanCodes, DEFAULT_THUMB, DEFAULT_TOP, DENSITIES, THUMB_MAX, VISIBLE_KEYS, type Accent, type Density } from './taste.ts';
import { useSheet } from './estilos-css.ts';
import { syncThemeColor } from './theme.svelte.ts';

export { ACCENTS, DEFAULT_THUMB, DEFAULT_TOP, DENSITIES, THUMB_MAX, VISIBLE_KEYS, type Accent, type Density };

const KEYS = { style: 'arc-style', accent: 'arc-accent', density: 'arc-density', top: 'arc-keys', thumb: 'arc-thumb' };

export const taste = $state({
	style: 'terminal',
	accent: 'auto' as Accent,
	density: 'normal' as Density,
	top: [...DEFAULT_TOP],
	thumb: [...DEFAULT_THUMB]
});

function read(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function write(key: string, value: string | null) {
	try {
		if (value === null) localStorage.removeItem(key);
		else localStorage.setItem(key, value);
	} catch {}
}

function json(key: string): unknown {
	try {
		return JSON.parse(read(key) ?? 'null');
	} catch {
		return null;
	}
}

/** Se llama al arrancar en el navegador (desde el layout). */
export function initTaste() {
	// src/app.html ya ha elegido y guardado la estética antes de pintar: aquí solo se lee.
	taste.style = document.documentElement.dataset.style ?? 'terminal';
	const accent = read(KEYS.accent);
	if (accent === 'amber' || accent === 'cyan' || accent === 'blue') taste.accent = accent;
	const density = read(KEYS.density);
	if (density === 'compacta' || density === 'comoda') taste.density = density;
	taste.top = cleanCodes(json(KEYS.top)) ?? [...DEFAULT_TOP];
	taste.thumb = cleanCodes(json(KEYS.thumb), THUMB_MAX) ?? [...DEFAULT_THUMB];
	// <html data-scrolled> en cuanto la página baja un poco: para estéticas con títulos grandes que se encogen o
	// barras que ganan sombra al hacer scroll (docs/estilos.md, «Estructura»).
	const root = document.documentElement;
	const onScroll = () => {
		const down = scrollY > 24;
		if (down !== ('scrolled' in root.dataset)) {
			if (down) root.dataset.scrolled = '';
			else delete root.dataset.scrolled;
		}
	};
	onScroll();
	addEventListener('scroll', onScroll, { passive: true });
	return () => removeEventListener('scroll', onScroll);
}

/** Estética: siempre se guarda (también «Terminal»), para que src/app.html no la vuelva a decidir. */
export function setStyle(style: string) {
	taste.style = style;
	document.documentElement.dataset.style = style;
	write(KEYS.style, style);
	useSheet(style, 'style-sheet');
	// La barra del navegador del móvil, con el fondo de la estética nueva. useSheet solo cambia el href: la hoja llega
	// después y hasta su «load» --bg sigue siendo el de la anterior. Terminal no tiene hoja (y si es la misma, ya
	// está): por eso también se pone en el acto. addEventListener no repite la misma función si ya estaba.
	// En Arc OS no: la barra lleva el fondo de su aspecto, y src/lib/os/look.ts quita data-style justo después (aquí
	// aún está puesto, así que se leería el --bg de la estética).
	if ('osLook' in document.documentElement.dataset) return;
	document.getElementById('style-sheet')?.addEventListener('load', syncThemeColor, { once: true });
	syncThemeColor();
}

export function setAccent(accent: Accent) {
	taste.accent = accent;
	if (accent === 'auto') delete document.documentElement.dataset.accent;
	else document.documentElement.dataset.accent = accent;
	write(KEYS.accent, accent === 'auto' ? null : accent);
}

/** Densidad: como el acento, en <html data-density> (también lo pone src/app.html antes de pintar). */
export function setDensity(density: Density) {
	taste.density = density;
	if (density === 'normal') delete document.documentElement.dataset.density;
	else document.documentElement.dataset.density = density;
	write(KEYS.density, density === 'normal' ? null : density);
}

export function setTop(codes: string[]) {
	taste.top = cleanCodes(codes) ?? [...DEFAULT_TOP];
	write(KEYS.top, JSON.stringify(taste.top));
}

/** Al pasar de 4, sale la primera de la lista: la última tocada siempre entra. */
export function setThumb(codes: string[]) {
	const added = codes.filter((c) => !taste.thumb.includes(c));
	const kept = codes.filter((c) => taste.thumb.includes(c));
	const next = [...kept.slice(Math.max(0, kept.length + added.length - THUMB_MAX)), ...added];
	taste.thumb = cleanCodes(next, THUMB_MAX) ?? [...DEFAULT_THUMB];
	write(KEYS.thumb, JSON.stringify(taste.thumb));
}

/** Vuelve a lo de la web. */
export function resetTaste() {
	setAccent('auto');
	setDensity('normal');
	taste.top = [...DEFAULT_TOP];
	taste.thumb = [...DEFAULT_THUMB];
	write(KEYS.top, null);
	write(KEYS.thumb, null);
}

// «A tu gusto» (lote 17, punto 6): color de acento y qué secciones van en la fila de arriba y en la barra
// inferior del móvil. Se guarda en este navegador; sin nada guardado, todo queda como siempre.
// El acento va en <html data-accent> (lo pone ya src/app.html antes de pintar, para que no parpadee) y
// tokens.css redefine --amber y compañía: ningún componente sabe de qué color es el acento.
import { ACCENTS, cleanCodes, DEFAULT_THUMB, DEFAULT_TOP, DENSITIES, STYLES, THUMB_MAX, type Accent, type Density, type Style } from './taste.ts';

export { ACCENTS, DEFAULT_THUMB, DEFAULT_TOP, DENSITIES, STYLES, THUMB_MAX, type Accent, type Density, type Style };

const KEYS = { style: 'arc-style', accent: 'arc-accent', density: 'arc-density', top: 'arc-keys', thumb: 'arc-thumb' };

export const taste = $state({
	style: 'terminal' as Style,
	accent: 'amber' as Accent,
	density: 'compacta' as Density,
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
	taste.style = document.documentElement.dataset.style === 'modern' ? 'modern' : 'terminal';
	const accent = read(KEYS.accent);
	if (accent === 'cyan' || accent === 'blue') taste.accent = accent;
	if (read(KEYS.density) === 'comoda') taste.density = 'comoda';
	taste.top = cleanCodes(json(KEYS.top)) ?? [...DEFAULT_TOP];
	taste.thumb = cleanCodes(json(KEYS.thumb), THUMB_MAX) ?? [...DEFAULT_THUMB];
}

/** Estética: siempre se guarda (también «Terminal»), para que src/app.html no la vuelva a decidir. */
export function setStyle(style: Style) {
	taste.style = style;
	document.documentElement.dataset.style = style;
	write(KEYS.style, style);
	if (style === 'modern') loadModernFont();
}

/** Inter solo se descarga con «Moderna» (src/app.html hace lo mismo al arrancar). */
function loadModernFont() {
	if (document.getElementById('font-modern')) return;
	const link = document.createElement('link');
	link.id = 'font-modern';
	link.rel = 'stylesheet';
	link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
	document.head.append(link);
}

export function setAccent(accent: Accent) {
	taste.accent = accent;
	if (accent === 'amber') delete document.documentElement.dataset.accent;
	else document.documentElement.dataset.accent = accent;
	write(KEYS.accent, accent === 'amber' ? null : accent);
}

/** Densidad: como el acento, en <html data-density> (también lo pone src/app.html antes de pintar). */
export function setDensity(density: Density) {
	taste.density = density;
	if (density === 'compacta') delete document.documentElement.dataset.density;
	else document.documentElement.dataset.density = density;
	write(KEYS.density, density === 'compacta' ? null : density);
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
	setAccent('amber');
	setDensity('compacta');
	taste.top = [...DEFAULT_TOP];
	taste.thumb = [...DEFAULT_THUMB];
	write(KEYS.top, null);
	write(KEYS.thumb, null);
}

// Arc OS: el registro de apps. Cada vista de la barra (COMMANDS), cada experiencia (EXPERIENCES) y cada
// herramienta propia del escritorio (un archivo en src/lib/os/apps/, como los comandos) es una app con id,
// nombre, icono, ruta y tamaño por defecto. No se duplica nada: las vistas y las experiencias salen de sus
// registros; aquí solo se añaden el icono y el tamaño. import.meta.glob es de Vite (como commands.ts).
import type { Component } from 'svelte';
import { COMMANDS, type Command } from '../commands.ts';
import { EXPERIENCES, expHref, type Experience } from '../experiences.ts';

export type AppKind = 'vista' | 'exp' | 'herramienta';

/** Lo que recibe una herramienta que se pinta con su propio componente (no con una ruta). */
export interface AppProps {
	/** uid de la ventana que la contiene. */
	win: string;
}

export interface OsApp {
	/** Vistas: el código en minúsculas («eco»). Experiencias: «x:<id>». Herramientas: su nombre («terminal»). */
	id: string;
	name: string;
	/** Un carácter (emoji o símbolo) para el menú, la barra y el título de la ventana. */
	icon: string;
	kind: AppKind;
	/** Qué es, en una frase (menú Inicio, buscador). */
	desc: string;
	/** Código de la barra de comandos, si lo tiene («ECO»). */
	code?: string;
	/** Ruta que se pinta en la ventana (embebida, sin la cabecera de la web). Las herramientas pueden no tenerla. */
	href?: string;
	/** Herramientas: su componente, cargado solo al abrirla. Si está, manda sobre href. */
	load?: () => Promise<{ default: Component<AppProps> }>;
	/** Tamaño inicial en px (se recorta al escritorio). */
	size: { w: number; h: number };
	/** Solo una ventana a la vez (abrirla otra vez la trae al frente). Por defecto, sí. */
	single?: boolean;
	/** Posición en el menú (de 10 en 10). */
	order: number;
}

/** Lo que exporta cada archivo de src/lib/os/apps/ (sin kind: siempre es una herramienta). */
export type ToolApp = Omit<OsApp, 'kind'>;

/** Vistas que no son apps: el propio escritorio las sustituye (TV, MODO, EXP: índice), o son de un solo uso. */
const NOT_APPS = new Set(['OS', 'TV', 'MODO', 'EXP', 'BIENVENIDA', 'ADMIN']);

const ICONS: Record<string, string> = {
	TOP: '▦', IMP: '★', SEMANA: '◫', ECO: '％', GEO: '◍', ES: '◩', WS: '＄', WB: '≋', BTMM: '⇄', G: '⌇', SEAS: '◔',
	MOST: '⇅', EQS: '⌕', IMAP: '▤', RV: '⚖', SIG: '⚑', MIS: '☆', TECH: '⌘', AI: '✧', BOE: '§', USGOV: '⚐',
	LUZ: 'ϟ', WX: '☁', VIAJE: '✈', FUEL: '⛽', HIPOTECA: '⌂', CARTERA: '◧', CAL: '▣', CHESS: '♞', FONDOS: '◑',
	HDS: '◐', RSS: '◉', ESTILO: '◈', AVISOS: '◬', NEWS: '≡', WIKI: 'W', STATUS: '●', HELP: '?', MANUAL: '❡',
	GLOBO: '⊕', PAIS: '⚑', LIDER: '♟', AGUA: '≈', CMP: '⇆', DOC: '¶', ECST: '∑', NOVEDADES: '✦', PORT: '⚓'
};

/** Tamaños que no son el de por defecto (los que piden más o menos sitio). */
const SIZES: Record<string, { w: number; h: number }> = {
	TOP: { w: 1120, h: 720 }, GEO: { w: 1040, h: 700 }, WS: { w: 1040, h: 700 }, IMAP: { w: 1040, h: 700 },
	CHESS: { w: 760, h: 760 }, STATUS: { w: 720, h: 560 }, HELP: { w: 760, h: 640 }, CMP: { w: 960, h: 640 }
};

export const DEFAULT_SIZE = { w: 880, h: 600 };
const EXP_SIZE = { w: 1040, h: 680 };

export const fromCommand = (c: Command): OsApp => ({
	id: c.code.toLowerCase(),
	name: c.key,
	icon: ICONS[c.code] ?? c.code.slice(0, 1),
	kind: 'vista',
	desc: c.desc,
	code: c.code,
	href: c.route,
	size: SIZES[c.code] ?? DEFAULT_SIZE,
	order: c.order
});

export const fromExperience = (e: Experience): OsApp => ({
	id: `x:${e.id}`,
	name: e.name,
	icon: e.icon,
	kind: 'exp',
	desc: e.desc,
	href: expHref(e),
	size: EXP_SIZE,
	order: 1000 + e.order
});

const tools = import.meta.glob<ToolApp>('./apps/*.ts', { eager: true, import: 'default' });

export const APPS: OsApp[] = [
	...COMMANDS.filter((c) => !NOT_APPS.has(c.code)).map(fromCommand),
	...EXPERIENCES.map(fromExperience),
	...Object.values(tools).map((t): OsApp => ({ ...t, kind: 'herramienta' }))
];

export const findApp = (id: string, list = APPS) => list.find((a) => a.id === id);

/** La app de una ruta («/eco» → ECO, «/x/zen» → Zen), para abrir en una ventana un enlace de la web. */
export function appOfPath(path: string, list = APPS): OsApp | undefined {
	const clean = path.split(/[?#]/)[0].replace(/\/+$/, '') || '/';
	return list.find((a) => a.href === clean) ?? list.find((a) => a.href && a.href !== '/' && clean.startsWith(a.href + '/'));
}

/** Lo que va en el src de la ventana: la ruta con ?embed=1 (src/app.html quita la cabecera de la web). */
export function embedSrc(path: string): string {
	const [base, hash = ''] = path.split('#');
	return `${base}${base.includes('?') ? '&' : '?'}embed=1${hash ? `#${hash}` : ''}`;
}

export { unembed } from './embed.ts';

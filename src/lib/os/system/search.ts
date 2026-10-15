// Buscador universal de Arc OS (Spotlight del escritorio y del móvil): apps, lo que entiende la barra de
// comandos («NEWS inflación», «LUZ mañana», «NVDA GP»), valores, países, líderes y ajustes del sistema.
// Lógica pura: devuelve resultados con su acción; quien los enseña los ejecuta con runHit (search.svelte.ts).
import { APPS, type OsApp } from '../apps.ts';
import { isTickerLike, norm, resolveInput, targetPath, type Target } from '../../cmdline.ts';
import { COUNTRIES } from '../../countries.ts';
import { LEADERS } from '../../leaders.ts';
import { fold } from '../../search.ts';
import { TICKERS } from '../../tickers.ts';

export type HitKind = 'App' | 'Comando' | 'Valor' | 'País' | 'Líder' | 'Ajuste';

/** Lo que hace un resultado: abrir una app, abrir una ruta en una ventana o una acción del sistema. */
export type HitAction = { app: string } | { path: string } | { sys: SysAction };
export type SysAction = 'lock' | 'leave' | 'control' | 'notices' | 'desktop';

export interface Hit {
	/** Único en la lista (para el {#each}). */
	id: string;
	kind: HitKind;
	title: string;
	detail: string;
	icon: string;
	action: HitAction;
}

/** Ajustes y acciones del sistema que se pueden buscar por su nombre. */
export const SETTINGS: { title: string; detail: string; icon: string; words: string; action: HitAction }[] = [
	{ title: 'Bloquear la pantalla', detail: 'Ctrl+Alt+L', icon: '🔒', words: 'bloquear bloqueo lock pantalla', action: { sys: 'lock' } },
	{ title: 'Salir al Terminal clásico', detail: 'Arc Terminal sin escritorio', icon: '⏻', words: 'salir clasico terminal apagar cerrar sesion', action: { sys: 'leave' } },
	{ title: 'Panel de control', detail: 'Barra, fondo, widgets', icon: '⚙', words: 'panel control ajustes configuracion preferencias fondo pantalla wallpaper barra widgets', action: { sys: 'control' } },
	{ title: 'Centro de notificaciones', detail: 'Avisos y novedades', icon: '🔔', words: 'notificaciones avisos novedades campana', action: { sys: 'notices' } },
	{ title: 'Estética', detail: 'Terminal, Grafito, Cristal…', icon: '🎨', words: 'estetica estilo tema aspecto colores apariencia', action: { path: '/estilo' } },
	{ title: 'Modo Sencillo o Terminal', detail: 'Lo esencial o todo', icon: '◐', words: 'modo sencillo terminal letra grande', action: { path: '/modo' } },
	{ title: 'Tus avisos al móvil', detail: 'Temas, nivel y silencio', icon: '📲', words: 'avisos alertas movil ntfy notificaciones', action: { path: '/avisos' } },
	{ title: 'Ayuda y atajos', detail: 'HELP', icon: '?', words: 'ayuda atajos teclado help manual', action: { path: '/help' } }
];

const MAX = 12;

/** La ruta de lo que entiende la barra («/news?q=inflación»). */
const pathOf = (t: Target) => {
	const { route, search } = targetPath(t);
	return `${route}${search}`;
};

const words = (q: string) => fold(q).split(/\s+/).filter(Boolean);
const has = (hay: string, ws: string[]) => {
	const h = fold(hay);
	return ws.every((w) => h.includes(w));
};

/** Puntuación: código exacto, luego empieza por, luego contiene. Menor es mejor. */
function rank(q: string, code: string | undefined, title: string): number {
	const f = fold(q);
	if (code && fold(code) === f) return 0;
	if (fold(title) === f) return 0;
	if (fold(title).startsWith(f) || (code && fold(code).startsWith(f))) return 1;
	return 2;
}

/** Todo lo que coincide con `q`, como mucho `limit`, con las apps y la barra primero. */
export function searchAll(q: string, apps: readonly OsApp[] = APPS, limit = MAX): Hit[] {
	const ws = words(q);
	if (!ws.length) return [];
	const scored: { hit: Hit; score: number }[] = [];
	const add = (hit: Hit, score: number) => scored.push({ hit, score });

	for (const a of apps)
		if (has([a.name, a.code ?? '', a.desc].join(' '), ws))
			add({ id: `app:${a.id}`, kind: 'App', title: a.name, detail: a.code ? `${a.code} · ${a.desc}` : a.desc, icon: a.icon, action: { app: a.id } }, rank(q, a.code, a.name));

	// Lo que haría la barra con el texto entero, si es un comando con algo detrás («NEWS inflación», «ECO paro»).
	const t = resolveInput(q, []);
	if (t && t.kind !== 'symbol' && /\s/.test(q.trim())) {
		add({ id: `cmd:${q}`, kind: 'Comando', title: q.trim(), detail: `Barra de comandos · ${t.command.desc}`, icon: '>', action: { path: pathOf(t) } }, 0.5);
	}

	for (const tk of TICKERS)
		if (has([tk.code, tk.name, ...(tk.aliases ?? [])].join(' '), ws))
			add({ id: `tk:${tk.code}`, kind: 'Valor', title: tk.name, detail: tk.code, icon: '◆', action: { path: `/s?sym=${encodeURIComponent(tk.code)}` } }, rank(q, tk.code, tk.name) + 0.2);

	for (const c of COUNTRIES)
		if (has([c.name, c.code, ...(c.aliases ?? [])].join(' '), ws))
			add({ id: `pais:${c.code}`, kind: 'País', title: c.name, detail: `Ficha del país · ${c.code}`, icon: '⚑', action: { path: `/pais?c=${c.code}` } }, rank(q, c.code, c.name) + 0.4);

	for (const l of LEADERS)
		if (has([l.name, l.role, ...l.aliases].join(' '), ws))
			add({ id: `lider:${l.id}`, kind: 'Líder', title: l.name, detail: l.role, icon: '☺', action: { path: `/lider?id=${l.id}` } }, rank(q, undefined, l.name) + 0.4);

	for (const s of SETTINGS)
		if (has(`${s.title} ${s.words}`, ws)) add({ id: `set:${s.title}`, kind: 'Ajuste', title: s.title, detail: s.detail, icon: s.icon, action: s.action }, rank(q, undefined, s.title) + 0.3);

	// Un valor que no está en la lista («TSM»): su ficha, al final.
	if (isTickerLike(q) && q.trim().length <= 6 && !scored.some((x) => x.hit.kind === 'Valor' || x.hit.kind === 'App'))
		add({ id: `sym:${norm(q)}`, kind: 'Valor', title: norm(q), detail: 'Ficha del valor', icon: '◆', action: { path: `/s?sym=${encodeURIComponent(norm(q))}` } }, 3);

	const seen = new Set<string>();
	return scored
		.sort((a, b) => a.score - b.score || a.hit.title.localeCompare(b.hit.title, 'es'))
		.map((x) => x.hit)
		.filter((h) => !seen.has(h.id) && (seen.add(h.id), true))
		.slice(0, limit);
}

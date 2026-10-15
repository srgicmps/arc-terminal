// Pantalla de inicio del Modo OS en el móvil (≤ 900 px): qué apps hay, cómo se reparten en páginas y el dock.
// Lógica pura. Las apps salen de los comandos y de las experiencias (las experiencias son apps); si el núcleo de
// Arc OS publica su propio registro, se le pasa a `pages()` con la misma forma mínima.

import { COMMANDS } from '../../commands.ts';
import { EXPERIENCES, expHref } from '../../experiences.ts';

export interface MobileApp {
	id: string;
	title: string;
	/** Icono: un carácter (experiencias) o, sin él, el código en monograma (ECO, WS…). */
	icon?: string;
	code?: string;
	/** Ruta que abre, sin la base. La Terminal no tiene: se abre dentro de la pantalla de inicio. */
	href?: string;
}

export const TERMINAL: MobileApp = { id: 'terminal', title: 'Terminal', icon: '>_' };

/** Las de siempre: comandos en su orden, luego experiencias. Sin HELP/MANUAL repetidos ni el propio EXP. */
export function allApps(): MobileApp[] {
	const cmds = COMMANDS.filter((c) => c.code !== 'EXP').map((c) => ({ id: c.code.toLowerCase(), title: c.key || c.code, code: c.code, href: c.route as string }));
	const exps = EXPERIENCES.map((e) => ({ id: `x:${e.id}`, title: e.name, icon: e.icon, href: expHref(e) }));
	return [TERMINAL, ...cmds, ...exps];
}

/** Dock fijo de abajo: 4 apps. */
export const DOCK_IDS = ['top', 'imp', 'ws', 'terminal'] as const;

/** Apps por página de la rejilla (4 columnas × 5 filas). */
export const PER_PAGE = 20;

/** Reparte las apps (sin las del dock) en páginas. */
export function pages(apps: MobileApp[], per = PER_PAGE, dock: readonly string[] = DOCK_IDS): MobileApp[][] {
	const rest = apps.filter((a) => !dock.includes(a.id));
	const out: MobileApp[][] = [];
	for (let i = 0; i < rest.length; i += per) out.push(rest.slice(i, i + per));
	return out;
}

export const dockApps = (apps: MobileApp[], dock: readonly string[] = DOCK_IDS) =>
	dock.map((id) => apps.find((a) => a.id === id)).filter((a): a is MobileApp => !!a);

/** Buscar en el cajón: por nombre o código, sin tildes. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export function findApps(apps: MobileApp[], q: string): MobileApp[] {
	const w = fold(q.trim());
	if (!w) return apps;
	return apps.filter((a) => fold(`${a.title} ${a.code ?? ''}`).includes(w));
}

/** Icono: el carácter propio o, sin él, el código entero como monograma (los largos, en letra menor). */
export const glyph = (a: MobileApp) => a.icon ?? a.code ?? a.title.slice(0, 3);

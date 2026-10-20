// Página de error (src/routes/+error.svelte): qué vista quería abrir una dirección que no existe y qué vistas
// hay guardadas en el dispositivo para usar sin conexión. Va sin Svelte para probarlo con Vitest.
import { COMMANDS, type Command } from './commands.ts';
import { didYouMean, findBloomberg, findCommand, norm, type Option } from './cmdline.ts';

/**
 * La caché de vistas del service worker (`PAGES` en src/service-worker/index.ts). Va copiada para no tocar el
 * service worker; un test comprueba que los dos nombres siguen siendo iguales.
 */
export const PAGES_CACHE = 'arc-pages';

/** Solo comandos: la página de error nunca manda a la ficha de un valor que quizá no existe. */
const OPTIONS: Option[] = COMMANDS.map((c) => ({ code: c.code, desc: c.desc, kind: 'Función', aliases: c.aliases }));

/** El comando de una pista o de un código de Bloomberg. */
const commandOf = (o: Option | undefined) => (o ? (findCommand(o.run ?? o.code) ?? findBloomberg(o.code)?.command) : undefined);

/**
 * «¿Querías decir…?» para una dirección que no existe, con el último trozo de la ruta, por orden: el código o un
 * alias enteros (/gasolina → FUEL), un código de Bloomberg (/wirp → ECO), el principio de un código o de un alias
 * (/ec → ECO, /hipotec → HIPOTECA) y una errata (/goe → GEO; /eocn → ECO, con una letra de más al final).
 */
export function guessCommand(pathname: string): Command | undefined {
	const last = pathname.split('/').filter(Boolean).at(-1) ?? '';
	let text = last;
	try {
		text = decodeURIComponent(last);
	} catch {}
	const q = norm(text);
	if (!q) return undefined;
	const exact = findCommand(q) ?? findBloomberg(q)?.command;
	if (exact) return exact;
	if (q.length >= 2) {
		const prefix = COMMANDS.find((c) => c.code.startsWith(q)) ?? COMMANDS.find((c) => c.aliases?.some((a) => norm(a).startsWith(q)));
		if (prefix) return prefix;
	}
	return commandOf(didYouMean(q, OPTIONS)[0]) ?? (q.length >= 4 ? commandOf(didYouMean(q.slice(0, -1), OPTIONS)[0]) : undefined);
}

/**
 * Las vistas guardadas en la caché de páginas, a partir de sus direcciones (`cache.keys()`), en el mismo orden y
 * sin repetir. Una vista abierta desde la barra guarda sus datos («/eco/__data.json») y una abierta de primeras,
 * su HTML («/eco» o «/eco/»): las dos cuentan. Los JSON sueltos de data/ no son vistas. `base`: la carpeta de la
 * web, si no está en la raíz.
 */
export function savedViews(urls: string[], base = ''): Command[] {
	const views = new Set<Command>();
	for (const href of urls) {
		let path: string;
		try {
			path = new URL(href, 'http://localhost/').pathname;
		} catch {
			continue;
		}
		if (base && path.startsWith(base)) path = path.slice(base.length);
		if (path.startsWith('/data/')) continue;
		path = path.replace(/\/__data\.json$/, '').replace(/\/$/, '') || '/';
		const command = COMMANDS.find((c) => c.route === path);
		if (command) views.add(command);
	}
	return [...views];
}

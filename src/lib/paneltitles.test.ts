// Los nombres de panel escritos a mano tienen que ser el título de un <Panel> de verdad: los esenciales y los
// títulos claros del modo Sencillo (simple.ts), los paneles del MANUAL (commands/*.ts) y los códigos de
// Bloomberg que llevan a un panel. Si un título cambia y su nombre no, no se ve ningún error: el panel
// desaparece en Sencillo, no se traduce o «GEO SANC» abre la vista sin bajar al panel. Este test lo avisa.
// Lee los .svelte como texto (sin Arc OS, que va aparte) y saca los títulos fijos de cada <Panel title=…>.
// Cada nombre se busca en SU vista: su +page.svelte y los .svelte que importa. Así, «Titulares» de GEO no
// pasa porque ECO tenga un panel «Titulares».
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMANDS } from './commands.ts';
import { samePanel } from './panelhash.ts';
import { ESSENTIAL, fold, PLAIN_TITLES } from './simple.ts';

/** Arc OS va aparte: sus ventanas no usan estas listas. */
const SKIP = ['src/lib/os/', 'src/lib/components/os/'];

/**
 * Paneles del MANUAL sin un título fijo que leer, con el porqué. Solo puede bajar: si uno ya cuadra o ya no
 * está en el manual, el test pide quitarlo de aquí.
 */
const DINAMICOS: Record<string, string> = {
	'TOP: Gasolina 95 · Menorca': 'el título lleva la provincia de cada uno; Menorca es la de por defecto',
	'IMP: Hoy / Últimos N días': 'el título cambia con el plazo elegido',
	'MOST: EE. UU.': 'título de la lista de bolsas de la vista ({b.title})',
	'MOST: Alemania': 'título de la lista de bolsas de la vista ({b.title})',
	'MOST: España': 'título de la lista de bolsas de la vista ({b.title})',
	'BOE: Secciones del BOE': 'un panel por sección, con su nombre',
	'LIDER: Un panel por líder': 'un panel por líder, con su nombre',
	'LUZ: Hoy / Mañana': 'un panel por día, con la fecha de título («LUZ mañana» va por la fecha)',
	'WX: Una ficha por ciudad': 'un panel por ciudad, con su nombre',
	'FUEL: Combustible · zona': 'el título es «<combustible> · <zona>»',
	'FUEL: Zona frente a España': 'el título es «<zona> frente a España»',
	'SIG: Máximos de 52 semanas': 'título de la lista de la vista ({side.title})',
	'SIG: Mínimos de 52 semanas': 'título de la lista de la vista ({side.title})',
	'FONDOS: Un panel por fondo': 'un panel por fondo, con su nombre',
	'CHESS: Evaluación': 'no es un panel: es la barra junto al tablero y las notas de «Jugadas» al analizar',
	'OS: Escritorio': 'Arc OS no usa <Panel>',
	'BIENVENIDA: Qué te interesa': 'es un paso del asistente, no un panel',
	'BIENVENIDA: Recorrido': 'es el recorrido guiado, no un panel'
};

const files = (readdirSync('src', { recursive: true }) as string[])
	.map((f) => join('src', f).replaceAll('\\', '/'))
	.filter((f) => f.endsWith('.svelte') && !SKIP.some((s) => f.startsWith(s)));

/** Desde `start` hasta el `>` que cierra la etiqueta, o hasta la `}` que cierra la expresión si `start` es una `{`. */
function scan(src: string, start: number): string {
	let depth = 0;
	let quote = '';
	for (let i = start; i < src.length; i++) {
		const c = src[i];
		if (quote) {
			if (c === '\\') i++;
			else if (c === quote) quote = '';
		} else if (c === '"' || c === "'" || c === '`') quote = c;
		else if (c === '{') depth++;
		else if (c === '}' && --depth === 0 && src[start] === '{') return src.slice(start, i + 1);
		else if (c === '>' && depth === 0) return src.slice(start, i + 1);
	}
	return src.slice(start);
}

/** Los principios de un título hasta cada « · »: «A · B · C» da «A» y «A · B». */
const prefixes = (t: string) => {
	const parts = t.split(' · ');
	return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join(' · '));
};

/**
 * Lo que se puede leer de un `title=`. `full`: los títulos fijos («Titulares»; en una expresión, sus textos,
 * como los dos lados de un `?:`). `heads`: los principios fijos, hasta « · », de los que llevan datos detrás
 * («Mar · {sitio}» da «Mar»).
 */
function titlesOf(tag: string): { full: string[]; heads: string[] } {
	const at = /\stitle=(["'{])/.exec(tag);
	if (!at) return { full: [], heads: [] };
	const start = at.index + at[0].length - 1;
	if (at[1] !== '{') {
		const value = tag.slice(start + 1, tag.indexOf(at[1], start + 1));
		const cut = value.indexOf('{');
		return cut < 0 ? { full: [value], heads: prefixes(value) } : { full: [], heads: prefixes(value.slice(0, cut)) };
	}
	const out = { full: [] as string[], heads: [] as string[] };
	for (const m of scan(tag, start).matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
		const text = m[1] ?? m[2] ?? m[3];
		const cut = text.indexOf('${');
		if (cut < 0) out.full.push(text);
		out.heads.push(...prefixes(cut < 0 ? text : text.slice(0, cut)));
	}
	return out;
}

/** Los `id` que puede llevar un <Panel>: el fijo (id="x") o los textos de su expresión (id={a ? 'x' : undefined}). */
function idsOf(tag: string): string[] {
	const at = /\sid=(["'{])/.exec(tag);
	if (!at) return [];
	const start = at.index + at[0].length - 1;
	if (at[1] !== '{') return [tag.slice(start + 1, tag.indexOf(at[1], start + 1))];
	return [...scan(tag, start).matchAll(/'([^']*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
}

/** Títulos fijos (tal cual) y principios hasta « · » de los <Panel> de cada .svelte de src, sin Arc OS; y sus id. */
const BY_FILE = new Map<string, string[]>();
const IDS_BY_FILE = new Map<string, string[]>();
const FULL = new Set<string>();
const HEADS = new Set<string>();
for (const f of files) {
	const src = readFileSync(f, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
	const titles: string[] = [];
	const ids: string[] = [];
	for (const m of src.matchAll(/<Panel(?=[\s>/])/g)) {
		const tag = scan(src, m.index);
		const { full, heads } = titlesOf(tag);
		for (const t of full) FULL.add(t);
		for (const h of heads) HEADS.add(h);
		titles.push(...full, ...heads);
		ids.push(...idsOf(tag));
	}
	BY_FILE.set(f, titles);
	IDS_BY_FILE.set(f, ids);
}

/** Adónde lleva un import de .svelte: #lib/ y $lib/ son src/lib; los relativos, desde su archivo. Un paquete, a ninguno. */
function resolve(from: string, spec: string): string | null {
	if (/^[#$]lib\//.test(spec)) return `src/lib/${spec.slice(5)}`;
	return spec.startsWith('.') ? join(dirname(from), spec).replaceAll('\\', '/') : null;
}

/** Los .svelte de una vista: su +page.svelte y lo que importa, también con import(), siguiendo los imports. */
function viewFiles(route: string): string[] {
	const start = `src/routes${route === '/' ? '' : route}/+page.svelte`;
	if (!existsSync(start)) return [];
	const seen = new Set([start]);
	for (const f of seen) {
		const src = readFileSync(f, 'utf8');
		for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)['"]([^'"]+\.svelte)['"]/g)) {
			const to = resolve(f, m[1]);
			if (to && BY_FILE.has(to)) seen.add(to);
		}
	}
	return [...seen];
}

/** Los títulos de los <Panel> de una vista (o de todas, si no hay ruta). */
const ALL = [...FULL, ...HEADS];
const VIEW = new Map<string, string[]>();
const titlesFor = (route?: string) => {
	if (!route) return ALL;
	if (!VIEW.has(route)) VIEW.set(route, [...new Set(viewFiles(route).flatMap((f) => BY_FILE.get(f) ?? []))]);
	return VIEW.get(route) ?? [];
};

/** ¿Hay un panel con ese título, o que empiece por él y « · »? Como lo comparan el modo Sencillo y el salto. */
const isTitle = (name: string, titles = ALL, same = (a: string, b: string) => a === b) => titles.some((t) => same(name, t));

describe('títulos de panel', () => {
	it('se leen bien del código (también los de varias líneas y los de una expresión)', () => {
		expect(FULL.size).toBeGreaterThan(200);
		for (const t of ['Titulares', 'Tráfico', 'Partida', 'Jugadas', 'Lo último']) expect(isTitle(t), t).toBe(true);
		expect(HEADS).toContain('Mar');
		// Por vista: sigue los imports (Tráfico está en Traffic.svelte; Puentes, en Puentes.svelte) y no mezcla vistas.
		expect(titlesFor('/es')).toContain('Tráfico');
		expect(titlesFor('/cal')).toContain('Puentes');
		expect(titlesFor('/eco')).toContain('Inflación');
		expect(titlesFor('/geo')).not.toContain('Inflación');
		expect(titlesOf('<Panel\n\tid="x"\n\ttitle={a ? `Hoy · ${b}` : "Ayer"}\n\tmeta={c > 1 ? "d" : "e"}\n>')).toEqual({ full: ['Ayer'], heads: ['Hoy'] });
	});

	it('cada esencial del modo Sencillo es un panel (o su principio, antes de « · »)', () => {
		const missing = Object.entries(ESSENTIAL).flatMap(([route, list]) =>
			list.filter((e) => !e.startsWith('id:') && !isTitle(e, titlesFor(route), (a, b) => fold(a) === fold(b))).map((e) => `${route}: ${e}`)
		);
		expect(missing).toEqual([]);
	});

	it('cada «id:» del modo Sencillo es el id de un <Panel> de su vista', () => {
		expect(idsOf('<Panel id={menorca ? undefined : \'avisos\'} title="Avisos">')).toEqual(['avisos']);
		expect(idsOf('<Panel\n\tid="precio"\n\ttitle={dia}>')).toEqual(['precio']);
		// TOP va aparte: sus paneles con id los pinta cada bloque de la portada, no un <Panel id=…> fijo.
		const missing = Object.entries(ESSENTIAL)
			.filter(([route]) => route !== '/')
			.flatMap(([route, list]) => {
				const ids = viewFiles(route).flatMap((f) => IDS_BY_FILE.get(f) ?? []);
				return list.filter((e) => e.startsWith('id:') && !ids.includes(e.slice(3))).map((e) => `${route}: ${e}`);
			});
		expect(missing).toEqual([]);
	});

	it('cada título claro del modo Sencillo es un panel (o su principio, antes de « · »)', () => {
		expect(Object.keys(PLAIN_TITLES).filter((k) => !isTitle(k))).toEqual([]);
	});

	const names = COMMANDS.flatMap((c) => [
		...(c.manual?.panels ?? []).map((p) => `${c.code}: ${p.name}`),
		...(c.bloomberg ?? []).flatMap((b) => (b.panel ? [`${c.code}: ${b.panel}`] : []))
	]);
	const routeOf = new Map(COMMANDS.map((c) => [c.code, c.route as string]));
	/** El panel tiene que estar en la vista del comando: «GEO titulares» no vale porque ECO tenga «Titulares». */
	const found = (key: string) => {
		const at = key.indexOf(': ');
		return isTitle(key.slice(at + 2), titlesFor(routeOf.get(key.slice(0, at))), samePanel);
	};

	it('cada panel del MANUAL y de un código de Bloomberg es un panel (la barra salta a él)', () => {
		expect(names.length).toBeGreaterThan(150);
		expect(names.filter((n) => !(n in DINAMICOS) && !found(n))).toEqual([]);
	});

	it('la lista de dinámicos solo baja: lo que ya cuadra o ya no está en el manual sale de ella', () => {
		expect(Object.keys(DINAMICOS).filter((k) => !names.includes(k) || found(k))).toEqual([]);
		for (const [k, why] of Object.entries(DINAMICOS)) expect(why.trim(), k).not.toBe('');
	});
});

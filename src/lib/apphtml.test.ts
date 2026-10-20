// El arranque de src/app.html (tema, modo y estética antes de pintar) no puede importar módulos: repite a mano las
// reglas de decideModo (modo.ts) y decideStyle (estilos.ts). Aquí se ejecuta ese <script> de verdad, con node:vm y un
// navegador de mentira (localStorage, document, location, window.parent), sobre una tabla de casos, y se compara lo
// que deja en <html> con lo que dicen esas dos funciones. Si un día se separan, este test lo dice.
import { existsSync, readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { decideStyle, ESTILOS, isStyle } from './estilos.ts';
import { decideModo, isModo } from './modo.ts';

const html = readFileSync('src/app.html', 'utf8');
/** Los <script> en línea de app.html, con la ruta de los recursos vacía (en la web la pone SvelteKit). */
const code = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
	.map((m) => m[1])
	.join('\n')
	.replaceAll('%sveltekit.assets%', '');

interface Caso {
	/** Lo que hay en localStorage al entrar. */
	stored: Record<string, string>;
	path?: string;
	search?: string;
	/** La página va dentro de un iframe (window.parent es otra ventana). */
	framed?: boolean;
	/** Lo que se espera: el escritorio de Arc OS (sin estética de la web) o una vista en su ventana (?embed=1). */
	os?: true;
	embed?: true;
}

/** Ejecuta el arranque con este navegador de mentira y devuelve lo que ha dejado. */
function boot({ stored, path = '/', search = '', framed = false }: Caso, blocked = false) {
	const store = new Map(Object.entries(stored));
	const no = () => {
		throw new Error('SecurityError: localStorage bloqueado');
	};
	const localStorage = blocked
		? { length: 0, key: no, getItem: no, setItem: no }
		: {
				get length() {
					return store.size;
				},
				key: (i: number) => [...store.keys()][i] ?? null,
				getItem: (k: string) => store.get(k) ?? null,
				setItem: (k: string, v: string) => void store.set(k, String(v))
			};
	const dataset: Record<string, string> = {};
	const written: string[] = [];
	const window: Record<string, unknown> = {
		localStorage,
		document: { documentElement: { dataset }, write: (s: string) => void written.push(s) },
		matchMedia: () => ({ matches: false }),
		location: { pathname: path, search }
	};
	window.window = window;
	window.parent = framed ? {} : window;
	runInNewContext(code, window);
	return { dataset, written, store };
}

/** El <link> de la hoja de una estética, tal como lo escribe app.html (Terminal no lleva: es tokens.css). */
const sheet = (id: string) => (id === 'terminal' ? [] : [`<link id="style-sheet" rel="stylesheet" href="/estilos/${id}.css">`]);

const casos: [string, Caso][] = [
	['navegador nuevo', { stored: {} }],
	['solo el tema guardado', { stored: { 'arc-theme': 'light' } }],
	['claves que no son de Arc', { stored: { 'otra-cosa': '1' } }],
	['lo que deja una primera visita', { stored: { 'arc-modo': 'sencillo', 'arc-style': 'grafito' } }],
	// La propia arc-modo no cuenta como «ya usaba la web»: con solo ella (y rara), Sencillo.
	['solo un modo raro', { stored: { 'arc-modo': 'raro' } }],
	['modo raro, con otras claves', { stored: { 'arc-modo': 'raro', 'arc-last-visit': 'x' } }],
	['«modern» (la antigua Grafito)', { stored: { 'arc-style': 'modern' } }],
	['«modern» con otras claves', { stored: { 'arc-style': 'modern', 'arc-theme': 'dark' } }],
	['una estética que no existe', { stored: { 'arc-style': 'nada' } }],
	['una estética que no existe, con otras claves', { stored: { 'arc-style': 'nada', 'arc-accent': 'cyan' } }],
	['en mayúsculas', { stored: { 'arc-style': 'GRAFITO' } }],
	['vacía', { stored: { 'arc-style': '', 'arc-density': 'comoda' } }],
	...ESTILOS.map((e): [string, Caso] => [`estética ${e.id}`, { stored: { 'arc-style': e.id, 'arc-modo': 'terminal' } }]),
	['escritorio de Arc OS', { stored: { 'arc-style': 'lujo' }, path: '/os', os: true }],
	['escritorio de Arc OS, navegador nuevo', { stored: {}, path: '/os/', os: true }],
	['una vista en una ventana de Arc OS', { stored: { 'arc-style': 'nada' }, path: '/geo', search: '?embed=1', framed: true, embed: true }],
	['?embed=1 en /os dentro de una ventana', { stored: { 'arc-style': 'lujo' }, path: '/os', search: '?x=1&embed=1', framed: true, embed: true }],
	['?embed=1 fuera de una ventana', { stored: { 'arc-style': 'lujo' }, path: '/os', search: '?embed=1', os: true }]
];

describe('src/app.html decide antes de pintar lo mismo que decideModo y decideStyle', () => {
	it.each(casos)('%s', (_, caso) => {
		const keys = Object.keys(caso.stored);
		const modo = decideModo(caso.stored['arc-modo'] ?? null, keys);
		const style = decideStyle(caso.stored['arc-style'] ?? null, keys);
		const { dataset, written, store } = boot(caso);

		expect(dataset.modo, 'modo').toBe(modo);
		// La decisión se guarda: la siguiente carga (y taste.svelte.ts) ya la leen.
		expect(store.get('arc-modo'), 'modo guardado').toBe(modo);
		expect(store.get('arc-style'), 'estética guardada').toBe(style);
		expect(dataset.theme).toBe(caso.stored['arc-theme'] === 'light' ? 'light' : 'dark');
		expect(dataset.embed).toBe(caso.embed ? '1' : undefined);
		if (caso.os) {
			// El escritorio de Arc OS lleva su aspecto (src/lib/os/look.ts), sin la estética ni su hoja.
			expect(dataset.osLook).toBe('1');
			expect(dataset.style).toBeUndefined();
			expect(written).toEqual([]);
		} else {
			expect(dataset.osLook).toBeUndefined();
			expect(dataset.style, 'estética').toBe(style);
			expect(written, 'hoja de la estética').toEqual(sheet(style));
		}
		// Una hoja que no existe sería un 404 que bloquea el pintado en cada carga.
		for (const link of written) expect(existsSync(`static${/href="([^"]+)"/.exec(link)?.[1]}`), link).toBe(true);
	});

	it('su lista de estéticas es la de ESTILOS (si falta una, quien la elija vuelve a Grafito o Terminal al cargar)', () => {
		const list = /var estilos\s*=\s*\[([^\]]*)\]/.exec(code)?.[1] ?? '';
		expect([...list.matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort()).toEqual(ESTILOS.map((e) => e.id).sort());
	});

	it('sin localStorage (bloqueado) arranca igual: modo y estética válidos, con su hoja', () => {
		const { dataset, written } = boot({ stored: {} }, true);
		expect(isModo(dataset.modo)).toBe(true);
		expect(isStyle(dataset.style)).toBe(true);
		expect(written).toEqual(sheet(dataset.style));
	});
});

// Texto sobre el fondo de acento suave (--amber-soft): botón encendido de un Seg con varias opciones, tramo que suena
// en la Radio, fila marcada… Con el tema de día va en --amber-dim (Seg.svelte, x/radio); de noche, en --amber o
// --amber-dim. Las dos combinaciones tienen que pasar de 4,5:1 (WCAG AA) sobre el panel y sobre el fondo, en cada
// estética. Complementa el test de contraste de estilos.test.ts, que solo mira colores macizos.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Palette = Record<string, string>;
const DIR = 'static/estilos';
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '');

function tokens(text: string, pick: (selector: string) => boolean): Palette {
	const out: Palette = {};
	for (const m of strip(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!pick(m[1].trim())) continue;
		for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
	}
	return out;
}

/** Color [r, g, b, a] de un #hex, rgba() o var(); null si no se puede medir (degradados, color-mix…). */
function color(value: string | undefined, all: Palette, depth = 0): number[] | null {
	if (!value || depth > 4) return null;
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	if (ref) return color(all[ref[1]], all, depth + 1);
	const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
	if (h) {
		const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
		return [...[0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)), 1];
	}
	const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+))?\s*\)$/.exec(value);
	return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null;
}

const over = (top: number[], bottom: number[]) => top.slice(0, 3).map((v, i) => v * top[3] + bottom[i] * (1 - top[3]));

function ratio(a: number[], b: number[]): number {
	const lum = (c: number[]) => {
		const [r, g, b2] = c.map((v) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4));
		return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
	};
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

const base = readFileSync('src/styles/tokens.css', 'utf8');
const baseDark = tokens(base, (s) => s.split(',')[0].trim() === ':root');
const baseLight = tokens(base, (s) => s.split(',')[0].trim() === ":root[data-theme='light']");

function palettes(id: string): Record<'dark' | 'light', Palette> {
	if (id === 'terminal') return { dark: baseDark, light: { ...baseDark, ...baseLight } };
	const text = readFileSync(`${DIR}/${id}.css`, 'utf8');
	const whole = (sel: string) => sel.split(',').every((p) => p.trim().endsWith(`[data-style='${id}']`));
	const dark = tokens(text, (s) => whole(s) && !s.includes('data-theme'));
	const light = tokens(text, (s) => whole(s) && s.includes("data-theme='light'"));
	return { dark: { ...baseDark, ...dark }, light: { ...baseDark, ...baseLight, ...dark, ...light } };
}

const ids = ['terminal', ...readdirSync(DIR).filter((f) => f.endsWith('.css')).map((f) => f.replace(/\.css$/, ''))];

describe('texto sobre el acento suave', () => {
	it('la paleta se lee (si no, el test no mediría nada)', () => {
		expect(color(baseLight['--amber-soft'], baseLight)?.[3]).toBeLessThan(1);
	});

	it('pasa de 4,5:1 en cada estética, de día (--amber-dim) y de noche (--amber)', () => {
		const bad: string[] = [];
		for (const id of ids) {
			const min = id === 'contraste' ? 7 : 4.5;
			for (const [theme, p] of Object.entries(palettes(id))) {
				const soft = color(p['--amber-soft'], p);
				const fg = color(p[theme === 'light' ? '--amber-dim' : '--amber'], p);
				if (!soft || !fg) continue;
				for (const surface of ['--panel', '--bg']) {
					const bg = color(p[surface], p);
					if (!bg || bg[3] < 1) continue;
					const r = ratio(fg, over(soft, bg));
					if (r < min) bad.push(`${id} (${theme}) sobre ${surface}: ${r.toFixed(2)}`);
				}
			}
		}
		expect(bad).toEqual([]);
	});
});

/** Todas las declaraciones (tokens y propiedades: background, color…) de los bloques cuyo selector cumple `pick`. */
function decls(text: string, pick: (selector: string) => boolean): Palette {
	const out: Palette = {};
	for (const m of strip(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!pick(m[1].trim())) continue;
		for (const d of m[2].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
	}
	return out;
}

/**
 * Lo que cambia una estética en la barra de comandos y en lo que la rodea, de fuera adentro: la raíz de la app
 * (`[data-ui='app']`), la cabecera (`[data-ui='top']`), el formulario (`.cmd`), la lista de sugerencias (`.suggest`) y
 * la fila elegida. Cupertino pone la lista en --cu-menu; lujo, en --bg; cristal, opaca; suizo, el código en --fg y la
 * fila elegida invertida; Fósforo guarda sus colores en --k-* en la raíz de la app, la cabecera los invierte y la
 * barra los recupera. Solo cuentan los bloques que acaban en esa pieza (no los de sus hijos), y los de día solo en el
 * tema de día.
 */
function bar(id: string, theme: string) {
	if (id === 'terminal') return { app: {}, top: {}, cmd: {}, list: {}, row: {} };
	const text = readFileSync(`${DIR}/${id}.css`, 'utf8');
	const ends = (re: RegExp) => (sel: string) =>
		(theme === 'light' || !sel.includes("data-theme='light'")) &&
		sel.split(',').every((p) => p.includes(`data-style='${id}'`) && re.test(p.trim()));
	return {
		app: decls(text, ends(/\[data-ui='app'\]$/)),
		top: decls(text, ends(/\[data-ui='top'\]$/)),
		cmd: decls(text, ends(/(?:\.cmd|\[data-ui='cmd'\])$/)),
		list: decls(text, ends(/(?:\.suggest|\[role='listbox'\])$/)),
		row: decls(text, ends(/(?:li|\[role='option'\])\[aria-selected='true'\]$/))
	};
}

const own = (d: Palette) => Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith('--')));

/** Sigue var(--x) dentro de `p` hasta llegar a un valor; si no lo encuentra, lo deja como está. */
function follow(value: string, p: Palette, depth = 0): string {
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	return ref && p[ref[1]] !== undefined && depth < 8 ? follow(p[ref[1]], p, depth + 1) : value;
}

/**
 * Las variables de un bloque sobre lo que hereda de fuera. Como en el navegador, cada var() se resuelve donde se
 * declara: así «--k-fg: var(--fg)» en la app y «--fg: var(--k-fg)» en la barra dan el color de la paleta y no un
 * círculo.
 */
function scope(outer: Palette, block: Palette): Palette {
	const here = { ...outer, ...own(block) };
	return { ...here, ...Object.fromEntries(Object.keys(own(block)).map((k) => [k, follow(here[k], here)])) };
}

// Las sugerencias de la barra van sobre --raise, igual que tarjetas, plegables y campos de las vistas. El texto, el
// secundario y el acento tienen que leerse ahí, y también el texto de la fila elegida, que lleva encima el acento suave.
describe('texto sobre --raise y en las sugerencias de la barra de comandos', () => {
	it('lee lo propio de la barra en cada estética (si no, mediría otra cosa)', () => {
		expect(bar('cupertino', 'dark').list['--raise']).toBe('var(--cu-menu)');
		expect(bar('suizo', 'light').row['background-color']).toBe('var(--fg)');
		expect(bar('retro', 'dark').cmd['--fg']).toBe('var(--k-fg)');
		expect(bar('retro', 'light').app['--k-fg']).toBe('var(--fg)');
		// Y lo resuelve como el navegador: la barra de Fósforo recupera el --fg de la paleta (de noche y de día).
		for (const [theme, p] of Object.entries(palettes('retro'))) {
			const b = bar('retro', theme);
			const lp = [b.app, b.top, b.cmd, b.list].reduce(scope, scope({}, p));
			expect(lp['--fg']).toBe(p['--fg']);
			expect(lp['--amber']).toBe(p['--amber']);
		}
	});

	it('la barra pinta las filas como mide este test: tipo en --muted y la fila elegida, del color de su texto', () => {
		const css = readFileSync('src/lib/components/CommandBar.svelte', 'utf8').split('<style>')[1];
		expect(css).toMatch(/\n\t\.kind \{\n\t\tcolor: var\(--muted\);/);
		expect(css).toMatch(/li\[aria-selected='true'\] \.code,\n\tli\[aria-selected='true'\] \.kind \{\n\t\tcolor: inherit;/);
	});

	it('pasa de 4,5:1 (7:1 en «Alto contraste») en cada estética, de noche y de día', () => {
		const bad: string[] = [];
		for (const id of ids) {
			const min = id === 'contraste' ? 7 : 4.5;
			for (const [theme, p] of Object.entries(palettes(id))) {
				// Un color que no se puede leer es un fallo: si no, esa estética se saltaría sin que nadie se enterase.
				const check = (what: string, fg: number[] | null, bg: number[] | null) => {
					if (!fg || !bg) return void bad.push(`${id} (${theme}) ${what}: no se puede medir`);
					const r = ratio(fg, bg);
					if (r < min) bad.push(`${id} (${theme}) ${what}: ${r.toFixed(2)}`);
				};
				// Vistas: texto, secundario y acento sobre --raise (si es opaco: con transparencia depende de lo que haya
				// debajo y no se mide aquí; la lista de sugerencias sí tiene que ser opaca, abajo).
				const raise = color(p['--raise'], p);
				if (!raise || raise[3] === 1)
					for (const fg of ['--fg', '--muted', '--amber']) check(`${fg} sobre --raise`, color(p[fg], p), raise);

				// Sugerencias: código (--amber), descripción (el color del texto) y tipo (--muted) sobre la lista.
				const b = bar(id, theme);
				const lp = [b.app, b.top, b.cmd, b.list].reduce(scope, scope({}, p));
				const listBg = color(b.list.background ?? b.list['background-color'] ?? 'var(--raise)', lp);
				if (!listBg || listBg[3] < 1) {
					bad.push(`${id} (${theme}) lista de sugerencias: fondo que no se puede medir`);
					continue;
				}
				const text = b.list.color ?? b.cmd.color ?? 'var(--fg)';
				check('código en la lista', color('var(--amber)', lp), listBg);
				check('descripción en la lista', color(text, lp), listBg);
				check('tipo en la lista', color('var(--muted)', lp), listBg);

				// Fila elegida: todo del color del texto de la fila, sobre el acento suave (o el fondo que le dé la estética).
				const rp = scope(lp, b.row);
				const top = color(b.row['background-color'] ?? b.row.background ?? 'var(--amber-soft)', rp);
				check('fila elegida', color(b.row.color ?? text, rp), top && over(top, listBg));
			}
		}
		expect(bad).toEqual([]);
	});
});

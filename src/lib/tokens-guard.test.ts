// «Nada de valores fijos» (CLAUDE.md, Sistema de diseño): ni colores ni fuentes escritos a mano en el CSS de
// las vistas y los componentes, siempre var(--…). Así un cambio de estética, de acento o el tema de día se
// hacen en un solo sitio. Este test lee los <style> de los .svelte y los .css de src y falla con el archivo
// y el valor. Fuera quedan las capas que definen los tokens (tokens.css y ajustes.css) y Arc OS, que tiene
// su propio aspecto (src/lib/os/look.ts). Los px no se miran: la geometría propia de un componente sí puede
// ir en px.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Lo que no se mira: las capas de tokens y Arc OS. */
const SKIP = ['src/styles/tokens.css', 'src/styles/ajustes.css', 'src/lib/os/', 'src/lib/components/os/'];

/**
 * Valores fijos que se quedan, con su porqué. Solo puede bajar: si uno ya no está, el test pide quitarlo.
 * Clave: «archivo: valor», como sale en el error.
 */
const EXCEPCIONES: Record<string, string> = {};

/** El CSS de un archivo: el .css entero o los <style> de un .svelte. */
function cssOf(file: string, text: string): string {
	if (file.endsWith('.css')) return text;
	return [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
}

/**
 * Las declaraciones («propiedad: valor») del CSS, sin comentarios ni url(…). En los textos entre comillas se
 * quitan «#», «;» y las llaves: un content: "#1" no es un color, y el nombre de una fuente se sigue leyendo.
 */
function declarations(css: string): { prop: string; value: string }[] {
	const clean = css
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/url\([^)]*\)/g, 'url()')
		.replace(/"[^"\n]*"|'[^'\n]*'/g, (q) => q.replace(/[#;{}]/g, ''));
	const out: { prop: string; value: string }[] = [];
	// Un trozo que acaba en «;» o «}» es una declaración; el que acaba en «{», un selector o una @regla.
	for (const m of clean.matchAll(/([^{};]*)([{};])/g)) {
		if (m[2] === '{') continue;
		const d = /^\s*(--[\w-]+|[a-z-]+)\s*:\s*([\s\S]+?)\s*$/i.exec(m[1]);
		if (d) out.push({ prop: d[1].toLowerCase(), value: d[2] });
	}
	return out;
}

/** Colores escritos a mano: #hex o una función de color con un número delante (rgb(0 0 0), hsl(30 …)). */
const COLOR = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/i;

/**
 * Colores con nombre («white»), solo en las propiedades de color: en una máscara, «black» es opacidad. Se
 * buscan sin los nombres de los tokens: var(--green) no es un color fijo.
 */
const NAMED =
	/\b(?:white|black|red|green|blue|gr[ae]y|orange|yellow|silver|navy|purple|pink|gold|aqua|cyan|fuchsia|lime|magenta|maroon|olive|teal|brown)\b/i;
const COLOR_PROP =
	/^(?:color|background(?:-color|-image)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke|stop-color|flood-color|lighting-color|box-shadow|text-shadow|caret-color|accent-color|scrollbar-color|text-decoration(?:-color)?|column-rule(?:-color)?|--[\w-]+)$/;
const TOKEN = /var\(--[\w-]+/g;

/** font-family solo con var(--…) o inherit. */
const FAMILY_OK = /^(?:var\(--[\w-]+\)|inherit)$/;
/**
 * En el atajo `font`, cada palabra es var(--…), un número o una medida, o una palabra clave (inherit, bold,
 * italic…). Cualquier otra es una fuente fija: «Helvetica», «monospace», «'IBM Plex Mono'».
 */
const FONT_WORD = /^(?:[\d.]+[a-z%]*|inherit|initial|unset|revert(?:-layer)?|normal|italic|oblique|bold(?:er)?|lighter|small-caps|(?:ultra-|extra-|semi-)?(?:condensed|expanded)|x{0,3}-?(?:small|large)|medium|smaller|larger)$/i;
const fixedFont = (v: string) =>
	v
		.replace(/var\(--[\w-]+\)/g, ' ')
		.split(/[\s,/]+/)
		.some((w) => w && !FONT_WORD.test(w));

/** Los valores fijos de un CSS, como «archivo: propiedad: valor». */
function violations(file: string, text: string): string[] {
	const out: string[] = [];
	for (const { prop, value } of declarations(cssOf(file, text))) {
		const v = value.replace(/\s*!important$/, '').replace(/\s+/g, ' ');
		const bad =
			COLOR.test(v) ||
			(COLOR_PROP.test(prop) && NAMED.test(v.replace(TOKEN, 'var('))) ||
			(prop === 'font-family' && !FAMILY_OK.test(v)) ||
			(prop === 'font' && fixedFont(v));
		if (bad) out.push(`${file}: ${prop}: ${v}`);
	}
	return [...new Set(out)];
}

const files = (readdirSync('src', { recursive: true }) as string[])
	.map((f) => join('src', f).replaceAll('\\', '/'))
	.filter((f) => /\.(svelte|css)$/.test(f) && !SKIP.some((s) => f.startsWith(s)));

const found = files.flatMap((f) => violations(f, readFileSync(f, 'utf8')));

describe('nada de valores fijos (colores y fuentes)', () => {
	it('mira los componentes y el CSS de src', () => {
		expect(files.length).toBeGreaterThan(150);
		expect(files).toContain('src/app.css');
		expect(files).not.toContain('src/styles/tokens.css');
	});

	it('distingue un valor fijo de un token (y no confunde selectores, url() ni máscaras)', () => {
		const svelte = (css: string) => violations('x.svelte', `<p>#fff</p>\n<style>\n${css}\n</style>`);
		expect(svelte('.a { color: #fff; }')).toEqual(['x.svelte: color: #fff']);
		expect(svelte('.a { background: rgb(0 0 0 / 50%) !important; }')).toEqual(['x.svelte: background: rgb(0 0 0 / 50%)']);
		expect(svelte('.a { --x: oklch(70% 0.1 80); }')).toEqual(['x.svelte: --x: oklch(70% 0.1 80)']);
		expect(svelte('.a { border-color: white; }')).toEqual(['x.svelte: border-color: white']);
		expect(svelte(".a { font-family: 'IBM Plex Mono', monospace; }")).toEqual(["x.svelte: font-family: 'IBM Plex Mono', monospace"]);
		expect(svelte('.a { font: 12px/1 monospace; }')).toEqual(['x.svelte: font: 12px/1 monospace']);
		expect(svelte('.a { font: 600 12px Helvetica; }')).toEqual(['x.svelte: font: 600 12px Helvetica']);
		expect(svelte('.a { background-image: linear-gradient(white, transparent); }')).toEqual(['x.svelte: background-image: linear-gradient(white, transparent)']);
		expect(svelte('.a { scrollbar-color: teal transparent; }')).toEqual(['x.svelte: scrollbar-color: teal transparent']);
		const ok = [
			'#add:hover, .b:not(#fade) { color: var(--amber); }',
			'.a { background: color-mix(in srgb, var(--amber) 20%, transparent); }',
			'.a { color: rgb(var(--amber-rgb) / 0.5); background: url("data:image/svg+xml;utf8,<svg fill=\'#fff\'/>"); }',
			'.a { mask-image: linear-gradient(black 80%, transparent); font: inherit; font-family: var(--mono); }',
			'.a { fill: var(--green); border-color: var(--os-close-red); font: italic 600 var(--fs-xs)/1.2 var(--mono); }',
			'/* color: #fff */ .a { content: "#fff"; }'
		];
		for (const css of ok) expect(svelte(css), css).toEqual([]);
	});

	it('cada color y cada fuente va con var(--…)', () => {
		expect(found.filter((v) => !(v in EXCEPCIONES))).toEqual([]);
	});

	it('la lista de excepciones solo baja: lo que ya no está sale de ella', () => {
		expect(Object.keys(EXCEPCIONES).filter((k) => !found.includes(k))).toEqual([]);
	});
});

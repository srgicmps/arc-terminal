import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideStyle, ESTILOS, fontsUrl, parseStyle } from './estilos.ts';

const DIR = 'src/styles/estilos';
const files = readdirSync(DIR).filter((f) => f.endsWith('.css'));
const css = (id: string) => readFileSync(`${DIR}/${id}.css`, 'utf8');

/** Los --tokens: #hex de los bloques cuyo selector cumple `pick`, en orden (el último manda). */
function tokens(text: string, pick: (selector: string) => boolean): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
		if (!pick(m[1].trim())) continue;
		for (const d of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[d[1]] = d[2].trim();
	}
	return out;
}

function hex(value: string | undefined, all: Record<string, string>, depth = 0): number[] | null {
	if (!value || depth > 4) return null;
	const ref = /^var\((--[\w-]+)\)$/.exec(value);
	if (ref) return hex(all[ref[1]], all, depth + 1);
	const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value)?.[1];
	if (!h) return null;
	const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
	return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

function contrast(a: number[], b: number[]): number {
	const lum = (c: number[]) => {
		const [r, g, b2] = c.map((v) => {
			const s = v / 255;
			return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
		});
		return 0.2126 * r + 0.7152 * g + 0.0722 * b2;
	};
	const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
	return (x + 0.05) / (y + 0.05);
}

const base = readFileSync('src/styles/tokens.css', 'utf8');
const baseDark = tokens(base, (s) => s.split(',')[0].trim() === ':root');
const baseLight = tokens(base, (s) => s.split(',')[0].trim() === ":root[data-theme='light']");

/** Paleta de una estética en cada tema: base, y encima lo suyo (en claro, también su bloque de día). */
function palettes(id: string) {
	if (id === 'terminal') return { dark: baseDark, light: { ...baseDark, ...baseLight } };
	const text = css(id);
	const dark = tokens(text, (s) => s.includes(`[data-style='${id}']`) && !s.includes('data-theme'));
	const light = tokens(text, (s) => s.includes(`[data-style='${id}']`) && s.includes("data-theme='light'"));
	return { dark: { ...baseDark, ...dark }, light: { ...baseDark, ...baseLight, ...dark, ...light } };
}

describe('estéticas', () => {
	it('la paleta base se lee bien (si no, el test de contraste no mediría nada)', () => {
		expect(baseDark['--fg']).toMatch(/^#/);
		expect(baseLight['--fg']).toMatch(/^#/);
		expect(palettes('grafito').light['--panel']).toBe('#ffffff');
	});

	it('ids únicos y nombres que se entienden en la barra', () => {
		expect(new Set(ESTILOS.map((e) => e.id)).size).toBe(ESTILOS.length);
		expect(parseStyle('Fósforo')).toBe('retro');
		expect(parseStyle(' alto contraste ')).toBe('contraste');
		expect(parseStyle('moderna')).toBe('grafito');
		expect(parseStyle('TERMINAL')).toBe('terminal');
		expect(parseStyle('rosa')).toBeNull();
		expect(parseStyle(null)).toBeNull();
	});

	it('quien ya usaba la web sigue en Terminal; quien llega nuevo, Grafito', () => {
		expect(decideStyle(null, ['arc-theme'])).toBe('terminal');
		expect(decideStyle(null, ['arc-modo', 'arc-style'])).toBe('grafito');
		expect(decideStyle('lujo', ['arc-theme'])).toBe('lujo');
		expect(decideStyle('modern', [])).toBe('grafito');
		expect(decideStyle('nada', [])).toBe('grafito');
	});

	it('src/app.html conoce las mismas estéticas y letras', () => {
		const html = readFileSync('src/app.html', 'utf8');
		for (const e of ESTILOS) expect(html, e.id).toContain(`${e.id}: '${e.fonts}'`);
		expect(html).toContain("q !== 'arc-modo' && q !== 'arc-style'");
	});

	it('una sola hoja de Google Fonts, sin familias repetidas', () => {
		const url = fontsUrl(ESTILOS.map((e) => e.id))!;
		const families = [...url.matchAll(/family=([^:&]+)/g)].map((m) => m[1]);
		expect(new Set(families).size).toBe(families.length);
		expect(fontsUrl(['terminal'])).toBeNull();
	});

	it('cada archivo de src/styles/estilos es una estética, en su capa, con su bloque de noche y de día', () => {
		for (const f of files) {
			const id = f.replace(/\.css$/, '');
			expect(ESTILOS.some((e) => e.id === id && id !== 'terminal'), f).toBe(true);
			const text = css(id);
			expect(text, f).toContain('@layer tokens, estilos, ajustes;\n@layer estilos {');
			expect(text, f).toMatch(new RegExp(`:root\\[data-style='${id}'\\],\\s*\\[data-style='${id}'\\]`));
			expect(text, f).toContain(`:root[data-theme='light'] [data-style='${id}']`);
			expect(text, f).not.toContain('!important');
		}
	});

	it('contraste AA (AAA en «Alto contraste») del texto, el acento, subidas y bajadas sobre el panel y el fondo', () => {
		const ids = ['terminal', ...files.map((f) => f.replace(/\.css$/, ''))];
		for (const id of ids) {
			const min = id === 'contraste' ? 7 : 4.5;
			for (const [theme, p] of Object.entries(palettes(id))) {
				for (const surface of ['--panel', '--bg']) {
					const bg = hex(p[surface], p);
					if (!bg) continue; // con degradado o transparencia no se puede medir aquí
					for (const fg of ['--fg', '--muted', '--faint', '--amber', '--up', '--down']) {
						const c = hex(p[fg], p);
						if (c) expect(contrast(c, bg), `${id} ${theme} ${fg} sobre ${surface}`).toBeGreaterThanOrEqual(min);
					}
				}
			}
		}
	});
});

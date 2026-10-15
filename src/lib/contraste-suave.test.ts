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

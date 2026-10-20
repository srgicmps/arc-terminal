import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keyboardInset } from './keyboard.ts';

describe('teclado en pantalla', () => {
	it('sin teclado (o solo la barra del navegador que se esconde), nada', () => {
		expect(keyboardInset({ height: 844, offsetTop: 0, scale: 1 }, 844)).toBeNull();
		expect(keyboardInset({ height: 760, offsetTop: 0, scale: 1 }, 844)).toBeNull();
		expect(keyboardInset({ height: 724, offsetTop: 0, scale: 1 }, 844)).toBeNull();
	});

	it('con teclado: lo que tapa por abajo y el alto que queda a la vista', () => {
		expect(keyboardInset({ height: 500, offsetTop: 0, scale: 1 }, 844)).toEqual({ bottom: 344, h: 500 });
		// iOS desplaza lo que se ve hacia abajo (offsetTop): tapa menos por abajo.
		expect(keyboardInset({ height: 500, offsetTop: 40, scale: 1 }, 844)).toEqual({ bottom: 304, h: 500 });
		expect(keyboardInset({ height: 500.4, offsetTop: 10.2, scale: 1 }, 844)).toEqual({ bottom: 333, h: 500 });
	});

	it('con zoom de pellizco manda el navegador', () => {
		expect(keyboardInset({ height: 400, offsetTop: 0, scale: 2 }, 844)).toBeNull();
	});

	it('nunca da un hueco negativo', () => {
		expect(keyboardInset({ height: 600, offsetTop: 300, scale: 1 }, 844)).toEqual({ bottom: 0, h: 600 });
	});

	it('la hoja de la barra de comandos se sube con el teclado también en las estéticas que la recolocan', () => {
		expect(readFileSync('src/lib/components/CommandBar.svelte', 'utf8')).toMatch(/\.cmd\.sheet \{[^}]*bottom: max\([^;]*var\(--kb-bottom, 0px\)/);
		const bad: string[] = [];
		for (const f of readdirSync('static/estilos').filter((f) => f.endsWith('.css'))) {
			const css = readFileSync(`static/estilos/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
			for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
				if (!m[1].split(',').some((p) => /\.sheet$/.test(p.trim()))) continue;
				const bottom = /(?:^|[;\s])bottom\s*:\s*([^;]+);/.exec(m[2])?.[1].trim();
				if (bottom && bottom !== 'auto' && !bottom.includes('--kb-bottom')) bad.push(`${f}: ${bottom}`);
			}
		}
		expect(bad).toEqual([]);
	});
});

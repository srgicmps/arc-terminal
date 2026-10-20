import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { keyboardInset, sheetRoom } from './keyboard.ts';

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

	it('las sugerencias de la hoja no cuentan el hueco que queda bajo ella (la barra de pestañas)', () => {
		// iPhone de 844 con barra inferior de 56 + 1 + 34 (zona segura): iOS ha desplazado lo que se ve hasta abajo, el
		// teclado no tapa nada de la ventana y la hoja se queda encima de la barra, 91 px por dentro de lo visible.
		const kb = keyboardInset({ height: 450, offsetTop: 394, scale: 1 }, 844)!;
		expect(kb).toEqual({ bottom: 0, h: 450 });
		expect(sheetRoom(kb, 56 + 1 + 34)).toBe(359);
		// Con --touch (44) y el aire (--sp-24) del CSS, la primera sugerencia empieza dentro de lo que se ve.
		const sheetTop = 844 - 91 - 44;
		expect(sheetTop - (sheetRoom(kb, 91) - 44 - 24)).toBeGreaterThanOrEqual(394);
		// El teclado tapa más que la barra: la hoja va pegada a él y no hay nada que descontar…
		expect(sheetRoom({ bottom: 344, h: 500 }, 344)).toBe(500);
		// …salvo el margen que le dan algunas estéticas (Cupertino, 10 px por encima del teclado).
		expect(sheetRoom({ bottom: 344, h: 500 }, 354)).toBe(490);
		expect(sheetRoom({ bottom: 0, h: 50 }, 91)).toBe(0);
	});

	it('la hoja de la barra de comandos se sube con el teclado también en las estéticas que la recolocan', () => {
		const bar = readFileSync('src/lib/components/CommandBar.svelte', 'utf8');
		expect(bar).toMatch(/\.cmd\.sheet \{[^}]*bottom: max\([^;]*var\(--kb-bottom, 0px\)/);
		// Y la lista mide con el hueco que la hoja deja debajo ya descontado (sheetRoom, con la hoja medida).
		expect(bar).toMatch(/sheetRoom\(kb, innerHeight - form\.getBoundingClientRect\(\)\.bottom\)/);
		expect(bar).toMatch(/style:--kb-h=\{room !== null/);
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

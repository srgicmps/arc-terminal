// QA OS 3 (iPhone e iPad): en una pantalla táctil, un `:hover` se queda pegado tras tocar. Arc OS los pone
// dentro de `@media (hover: hover)`; este test lo vigila en todos los componentes de src/lib/os y de las ventanas.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Archivos de OS 4b aún por pasar (Archivos y Centro de paquetes). */
const PENDING = ['fs/Folder.svelte', 'apps/packages/Packages.svelte', 'apps/files/Files.svelte'];

function svelteFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((f) => {
		const p = join(dir, f);
		return statSync(p).isDirectory() ? svelteFiles(p) : p.endsWith('.svelte') ? [p] : [];
	});
}

/** Selectores con `:hover` en reglas de primer nivel del <style> (fuera de cualquier @media). */
function looseHover(src: string): string[] {
	const css = src.match(/<style[^>]*>([\s\S]*)<\/style>/)?.[1] ?? '';
	const out: string[] = [];
	let depth = 0;
	let sel = '';
	for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, '')) {
		if (ch === '{') {
			if (depth === 0 && !sel.trim().startsWith('@')) {
				const hover = sel.split(',').filter((s) => /:hover/.test(s) && !/:not\([^)]*:hover/.test(s));
				out.push(...hover.map((s) => s.trim()));
			}
			depth++;
			sel = '';
		} else if (ch === '}') {
			depth--;
			sel = '';
		} else if (depth === 0) sel += ch;
	}
	return out;
}

describe('Arc OS en táctil', () => {
	it('detecta un :hover suelto y deja pasar el que va en @media (hover: hover)', () => {
		expect(looseHover('<style>a:hover{color:red} @media (hover: hover){b:hover{color:red}}</style>')).toEqual(['a:hover']);
	});
	it('ningún :hover suelto en src/lib/os ni en las ventanas', () => {
		const root = new URL('../', import.meta.url).pathname;
		const files = [...svelteFiles(join(root, 'os')), ...svelteFiles(join(root, 'components/os'))];
		const bad = files
			.filter((f) => !PENDING.some((p) => f.endsWith(p)))
			.flatMap((f) => looseHover(readFileSync(f, 'utf8')).map((s) => `${f.slice(root.length)}: ${s}`));
		expect(bad).toEqual([]);
	});
});

describe('Arc OS en Safari', () => {
	it('sin vh: en iPad la barra de Safari tapa lo que mide 100vh; se usa dvh', () => {
		const root = new URL('../', import.meta.url).pathname;
		const files = [...svelteFiles(join(root, 'os')), ...svelteFiles(join(root, 'components/os'))];
		const bad = files.filter((f) => /[\d.]vh\b/.test(readFileSync(f, 'utf8').split('<style')[1] ?? '')).map((f) => f.slice(root.length));
		expect(bad).toEqual([]);
	});
});

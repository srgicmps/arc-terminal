import { describe, expect, it } from 'vitest';
import { withCover } from './viewport.ts';

describe('withCover', () => {
	it('añade viewport-fit=cover a la etiqueta de la web', () => {
		expect(withCover('width=device-width, initial-scale=1')).toBe('width=device-width, initial-scale=1, viewport-fit=cover');
	});
	it('no lo repite ni deja otro valor', () => {
		expect(withCover('width=device-width,viewport-fit=auto')).toBe('width=device-width, viewport-fit=cover');
		expect(withCover(withCover('width=device-width'))).toBe('width=device-width, viewport-fit=cover');
	});
});

// Lo que Chromium no reproduce de Safari, comprobado en el código para que no vuelva (QA OS 3).
import { readFileSync } from 'node:fs';
const src = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

describe('Arc OS en iPhone', () => {
	it('/os pone viewport-fit=cover (si no, las zonas seguras valen 0)', () => {
		expect(src('../../../routes/os/+page.svelte')).toMatch(/coverViewport\(\)/);
	});
	it('el teléfono tiene rejilla para horizontal, sin zoom por doble toque y fuera de la muesca', () => {
		const home = src('./MobileHome.svelte');
		expect(home).toMatch(/@media \(orientation: landscape\) and \(max-height: 540px\)/);
		expect(home).toMatch(/touch-action: manipulation/);
		expect(home).toMatch(/env\(safe-area-inset-left/);
	});
});

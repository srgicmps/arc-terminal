// Cada pantalla de arranque de scripts/icons.ts existe en static/ y src/app.html la enlaza con su tamaño de iPhone.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const icons = readFileSync('scripts/icons.ts', 'utf8');
const html = readFileSync('src/app.html', 'utf8');
const splashes = [...icons.matchAll(/'(splash-(\d+)x(\d+)\.png)'/g)].map((m) => ({ file: m[1], w: +m[2], h: +m[3] }));

describe('pantallas de arranque del iPhone (PWA)', () => {
	it('hay varias, incluidos los iPhone 16 Pro y Pro Max', () => {
		expect(splashes.map((s) => s.file)).toEqual(expect.arrayContaining(['splash-1320x2868.png', 'splash-1206x2622.png']));
	});
	it.each(splashes)('$file está en static/ y enlazada con su media query', ({ file, w, h }) => {
		expect(existsSync(`static/${file}`)).toBe(true);
		const link = html.split('\n').find((l) => l.includes(`/${file}"`));
		expect(link).toBeDefined();
		const r = Number(link!.match(/pixel-ratio: (\d)/)![1]);
		expect(link).toContain(`device-width: ${w / r}px`);
		expect(link).toContain(`device-height: ${h / r}px`);
	});
});

// Guardas de CSS del inicio del teléfono: fallos vistos en Chromium a 320–390 px que la lógica no cubre.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (f: string) => readFileSync(new URL(f, import.meta.url), 'utf8');
const css = (f: string) => read(f).split('<style>')[1] ?? '';
/** El bloque de una regla («.minus {…}»), sin anidar. */
const rule = (src: string, sel: string) => src.match(new RegExp(`(^|\\n)\\s*${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`))?.[2] ?? '';

describe('inicio del teléfono (CSS)', () => {
	const home = css('./MobileHome.svelte');
	it('los iconos encogen con el alto de la página (iPhone SE: el nombre pisaba el icono de abajo)', () => {
		expect(rule(home, '.page')).toMatch(/container-type:\s*size/);
		expect(rule(home, '.page > .icon')).toMatch(/--os-icon-size:\s*clamp\(.*cqh/);
		// …y el dibujo sigue al hueco, no a los 58 px fijos de OsIcon.
		expect(css('./PhoneIcon.svelte')).toMatch(/\.sq > :global\(\.os-icon\)[^{]*\{[^}]*width: 100% !important/);
		expect(css('./PhoneFolderIcon.svelte')).toMatch(/\.mini > :global\(\.os-icon\)[^{]*\{[^}]*width: 100% !important/);
	});
	it('el «−» de los widgets es redondo con pantalla táctil (el min-height global lo estiraba)', () => {
		expect(rule(home, '.minus')).toMatch(/min-height:\s*0/);
	});
	it('en horizontal la rejilla pasa a 8 columnas y se desplaza (6 filas no caben en 390 px de alto)', () => {
		const land = home.split('@media (orientation: landscape)')[1] ?? '';
		expect(land).toMatch(/repeat\(8, 1fr\)/);
		expect(land).toMatch(/overflow-y:\s*auto/);
	});
	it('los widgets se ajustan a su hueco', () => {
		expect(rule(home, '.w-l,\n\t.w-s')).toMatch(/container-type:\s*size/);
		expect(css('./PhoneWidget.svelte')).toMatch(/@container \(max-height/);
	});
});

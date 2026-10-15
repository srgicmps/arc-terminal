import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UI } from './ui.ts';

const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9.,\-\s]*$/;

// Piezas fijas del escritorio «Mando»: sus iconos son SVG (ui.ts y OsIcon), no glifos de texto, que cada sistema
// dibuja con su fuente y a otra altura.
const CHROME = [
	'src/lib/os/shell/MandoBar.svelte',
	'src/lib/os/shell/NoticeCenter.svelte',
	'src/lib/os/shell/Widget.svelte',
	'src/lib/os/shell/ControlPanel.svelte',
	'src/lib/components/os/Window.svelte',
	'src/lib/os/apps/packages/Packages.svelte',
	'src/lib/os/system/wall/WallpaperApp.svelte'
];
const GLYPH = /[▦▭⌕⚙◬✕×–□❐↻✓◷☁☀▥☰●⚑]/u;

describe('iconos de interfaz de Arc OS', () => {
	it('son trazados válidos en el lienzo de 24', () => {
		for (const [id, d] of Object.entries(UI)) expect(PATH.test(d), id).toBe(true);
	});
	it('la barra, las ventanas y los menús no usan glifos de texto como icono', () => {
		for (const file of CHROME) {
			// Solo el marcado: sin comentarios ni <script>/<style>, donde los glifos pueden salir en las explicaciones.
			const markup = readFileSync(file, 'utf8')
				.replace(/<!--[\s\S]*?-->/g, '')
				.replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
			const tags = markup.match(/>[^<{]*</g) ?? [];
			expect(tags.filter((t) => GLYPH.test(t)), file).toEqual([]);
		}
	});
});

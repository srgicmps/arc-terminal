import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideStyle, ESTILOS, parseStyle } from './estilos.ts';

const DIR = 'static/estilos';
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
	// Solo los bloques de la estética entera (cada parte del selector acaba en [data-style='id']), no los retoques
	// de un elemento concreto (`[data-style='id'] .panel h2 { --faint: … }`).
	const whole = (sel: string) => sel.split(',').every((p) => p.trim().endsWith(`[data-style='${id}']`));
	const dark = tokens(text, (s) => whole(s) && !s.includes('data-theme'));
	const light = tokens(text, (s) => whole(s) && s.includes("data-theme='light'"));
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

	it('src/app.html aplica la misma regla y pone la hoja de la estética', () => {
		const html = readFileSync('src/app.html', 'utf8');
		expect(html).toContain("q !== 'arc-modo' && q !== 'arc-style'");
		expect(html).toContain("%sveltekit.assets%/estilos/' + st + '.css");
	});

	it('cada archivo de static/estilos es una estética, en su capa, con su bloque de noche y de día', () => {
		for (const f of files) {
			const id = f.replace(/\.css$/, '');
			expect(ESTILOS.some((e) => e.id === id && id !== 'terminal'), f).toBe(true);
			const text = css(id);
			expect(text, f).toMatch(/^(?:\/\*[\s\S]*?\*\/\s*)?(?:@import url\('[^']+'\);\n)*@layer tokens, estilos, ajustes;\n@layer estilos \{/);
			expect(text, f).toMatch(new RegExp(`:root\\[data-style='${id}'\\],\\s*\\[data-style='${id}'\\]`));
			expect(text, f).toContain(`:root[data-theme='light'] [data-style='${id}']`);
			expect(text, f).not.toContain('!important');
			// Letras: solo de Google Fonts (libres), con @import al principio.
			for (const m of text.matchAll(/@import\s+url\('([^']+)'\)/g)) expect(m[1], f).toMatch(/^https:\/\/fonts\.googleapis\.com\/css2\?/);
			expect(text.replace(/@import[^;]+;/g, ''), f).not.toMatch(/url\(\s*['"]?https?:/);
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

	it('el acento elegido en «A tu gusto» también llega a AA sobre el panel y el fondo de cada estética', () => {
		const aj = readFileSync('src/styles/ajustes.css', 'utf8');
		const accent = (a: string, light: boolean) => ({
			...tokens(aj, (s) => s.includes(`[data-accent='${a}']`) && !s.includes('data-theme')),
			...(light ? tokens(aj, (s) => s.includes(`[data-accent='${a}']`) && s.includes("data-theme='light'")) : {})
		});
		const ids = ['terminal', ...ESTILOS.filter((e) => !e.fixedAccent && e.id !== 'terminal').map((e) => e.id)];
		for (const id of ids)
			for (const [theme, p] of Object.entries(palettes(id)))
				for (const a of ['amber', 'cyan', 'blue']) {
					const amber = hex(accent(a, theme === 'light')['--amber'], {});
					expect(amber, a).not.toBeNull();
					for (const surface of ['--panel', '--bg']) {
						const bg = hex(p[surface], p);
						if (bg) expect(contrast(amber!, bg), `${id} ${theme} ${a} sobre ${surface}`).toBeGreaterThanOrEqual(4.5);
					}
				}
	});

	it('el botón de Apariencia (◐) se pinta como «⋯» (.theme) en cada estética', () => {
		// calido coloca la cabecera a mano (orden y márgenes de «⋯»), no su aspecto.
		for (const f of files.filter((f) => f !== 'calido.css'))
			for (const line of css(f.replace(/\.css$/, '')).split('\n'))
				if (/\.theme\b/.test(line) && !line.includes('[data-ui=')) {
					const text = css(f.replace(/\.css$/, ''));
					const at = text.indexOf(line);
					expect(text.slice(Math.max(0, at - 120), at + line.length + 120), `${f}: ${line.trim()}`).toContain("[data-ui='appearance']");
				}
	});

	it('Apariencia no usa la clase .sheet (Fósforo la lee como la barra de comandos abierta en hoja)', () => {
		expect(readFileSync('src/lib/components/Appearance.svelte', 'utf8')).not.toMatch(/class="(?:[^"]*\s)?sheet[\s"]/);
		expect(css('retro')).not.toContain(':has(> .sheet)');
	});

	it('los ganchos data-ui de docs/estilos.md siguen en su componente (las estéticas se enganchan a ellos)', () => {
		const hooks: Record<string, string> = {
			'src/routes/+layout.svelte': 'app top brand keys key tape main tabs foot',
			'src/lib/components/Clocks.svelte': 'clocks',
			'src/lib/components/PlacePicker.svelte': 'place',
			'src/lib/components/CommandBar.svelte': 'cmd',
			'src/lib/components/PanelIndex.svelte': 'panel-index',
			'src/lib/components/Panel.svelte': 'panel panel-head panel-meta fold panel-grow panel-close',
			'src/lib/components/ViewHeader.svelte': 'view-head view-title view-code view-sub view-sum',
			'src/lib/components/ui/Menu.svelte': 'menu',
			'src/lib/components/ui/Tile.svelte': 'tile',
			'src/lib/components/ui/Note.svelte': 'note',
			'src/lib/components/ui/Table.svelte': 'table',
			'src/lib/components/ui/Tiles.svelte': 'tiles',
			'src/lib/components/LineChart.svelte': 'chart'
		};
		const doc = readFileSync('docs/estilos.md', 'utf8');
		for (const [file, names] of Object.entries(hooks))
			for (const n of names.split(' ')) {
				expect(readFileSync(file, 'utf8'), `${file} ${n}`).toContain(`data-ui="${n}"`);
				expect(doc, n).toContain(`\`${n}\``);
			}
	});

	it('el acento de «A tu gusto» no se aplica justo en las estéticas con color fijo (ajustes.css = registro)', () => {
		const css = readFileSync('src/styles/ajustes.css', 'utf8');
		const fixed = ESTILOS.filter((e) => e.fixedAccent).map((e) => e.id).sort();
		const blocks = [...css.matchAll(/:root(?:\[data-theme='light'\])?\[data-accent='\w+'\]:not\(([^)]*)\)/g)];
		expect(blocks.length).toBe(6);
		for (const b of blocks) expect([...b[1].matchAll(/data-style='(\w+)'/g)].map((m) => m[1]).sort()).toEqual(fixed);
	});
});

// Lo que Chromium no reproduce de un iPhone (zonas seguras, barra de estado), comprobado en el código para que no vuelva.
describe('iPhone: zonas seguras y color de la barra', () => {
	it('toda la web lleva viewport-fit=cover (sin él, Safari deja a 0 los env(safe-area-inset-*))', () => {
		const meta = /<meta name="viewport" content="([^"]+)"/.exec(readFileSync('src/app.html', 'utf8'));
		expect(meta?.[1].split(',').map((p) => p.trim())).toContain('viewport-fit=cover');
	});

	it('al cambiar de estética, theme-color se pone otra vez cuando carga su hoja (y en el acto, para Terminal), salvo en Arc OS', () => {
		const theme = readFileSync('src/lib/theme.svelte.ts', 'utf8');
		expect(theme).toMatch(/export function syncThemeColor\(\)/);
		expect(theme).toMatch(/function apply\(\) {[^}]*syncThemeColor\(\);/);
		const setStyle = /export function setStyle\([^)]*\) {([\s\S]*?)\n}/.exec(readFileSync('src/lib/taste.svelte.ts', 'utf8'))?.[1] ?? '';
		const code = setStyle.replace(/\/\/.*$/gm, '');
		expect(code).toMatch(/getElementById\('style-sheet'\)\?\.addEventListener\('load', syncThemeColor/);
		expect(code).toMatch(/\n\tsyncThemeColor\(\);/);
		// En Arc OS, src/lib/os/look.ts quita data-style justo después: leer --bg aquí daría el de la estética, no el
		// del aspecto del escritorio. La guarda va antes de tocar theme-color.
		const guard = code.indexOf("if ('osLook' in document.documentElement.dataset) return;");
		expect(guard).toBeGreaterThan(-1);
		expect(guard).toBeLessThan(code.indexOf('syncThemeColor'));
	});

	it('el panel ampliado y lo fijo a los bordes se apartan de la muesca y de la barra de inicio', () => {
		const panel = readFileSync('src/lib/components/Panel.svelte', 'utf8');
		const max = /\.max {([^}]*)}/.exec(panel)?.[1] ?? '';
		for (const side of ['top', 'right', 'bottom', 'left']) expect(max).toContain(`env(safe-area-inset-${side}`);
		// En el móvil va a pantalla completa: lo último del panel, por encima de la barra de inicio.
		expect(/max-width: 720px\) {\s*\.max {([^}]*)}/.exec(panel)?.[1]).toContain('padding-bottom: env(safe-area-inset-bottom');
		const layout = readFileSync('src/routes/+layout.svelte', 'utf8');
		expect(/\.fresh {([^}]*)}/.exec(layout)?.[1]).toMatch(/right: max\([^;]*safe-area-inset-right[\s\S]*bottom: max\([^;]*safe-area-inset-bottom/);
		expect(/\.thumb {\s*position: fixed;([^}]*)}/.exec(layout)?.[1]).toContain('padding-bottom: env(safe-area-inset-bottom');
	});

	it('las hojas pegadas a un borde y el aviso del Muro también se apartan', () => {
		/** Algún bloque `selector {…}` del archivo usa la zona segura de cada lado. */
		const uses = (file: string, selector: string, sides: string[]) => {
			const text = readFileSync(file, 'utf8');
			const at = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const blocks = [...text.matchAll(new RegExp(`${at} {([^}]*)}`, 'g'))].map((m) => m[1]);
			for (const side of sides) expect(blocks.some((b) => b.includes(`env(safe-area-inset-${side}`)), `${file} ${selector} ${side}`).toBe(true);
		};
		// Apariencia: a la derecha en escritorio (y en el iPhone en horizontal) y desde abajo en el móvil.
		uses('src/lib/components/Appearance.svelte', '.in', ['right', 'bottom', 'left']);
		uses('src/lib/components/ExpLauncher.svelte', '.foot', ['bottom']);
		uses('src/routes/x/muro/+page.svelte', '.alert', ['top', 'right', 'bottom', 'left']);
		// Retro pisa el relleno de los paneles con una regla más específica: tiene que volver a sumar la barra de inicio.
		uses(`${DIR}/retro.css`, "[data-style='retro'][data-style] [data-ui='panel'].max", ['bottom']);
	});
});

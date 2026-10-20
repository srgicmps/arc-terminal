// Al salir de Arc OS, la barra del navegador del móvil (meta theme-color) vuelve al fondo de la estética, con el
// look.ts de verdad sobre un navegador de mentira: <html>, el <link> de la hoja (carga cuando se le dice), el meta y un
// getComputedStyle que da el --bg según lo que se ve. Los tests no pasan por el compilador de Svelte: $state va de
// mentira (theme.svelte.ts lo usa), igual que $app/paths (estilos-css.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ asset: (p: string) => p }));

/** --bg de cada cosa (los de verdad: Mando, Terminal y Grafito de noche). */
const BG = { mando: '#070c12', terminal: '#080a0d', grafito: '#0b0d10' };

/** El <link id="style-sheet">: cambia de href como el de verdad y solo «carga» cuando el test llama a load(). */
class FakeLink extends EventTarget {
	id = '';
	rel = '';
	disabled = false;
	loaded = false;
	#href = '';
	get href() {
		return this.#href;
	}
	set href(v: string) {
		this.#href = v;
		this.loaded = false;
	}
	getAttribute(k: string) {
		return k === 'href' ? this.#href || null : null;
	}
	remove() {
		els.delete(this.id);
	}
	load() {
		this.loaded = true;
		this.dispatchEvent(new Event('load'));
	}
}

let root: { dataset: Record<string, string> };
let els: Map<string, FakeLink>;
let meta: { content: string; setAttribute: (k: string, v: string) => void };
let store: Map<string, string>;

/** El --bg que se ve: el del aspecto en Arc OS; si no, el de la estética si su hoja ha cargado y está activa. */
function bg() {
	if ('osLook' in root.dataset) return BG.mando;
	const link = els.get('style-sheet');
	const id = link?.href.match(/estilos\/(\w+)\.css$/)?.[1] as keyof typeof BG | undefined;
	return link && id && link.loaded && !link.disabled && root.dataset.style === id ? BG[id] : BG.terminal;
}

beforeEach(() => {
	vi.resetModules();
	root = { dataset: { theme: 'dark' } };
	els = new Map();
	store = new Map();
	meta = { content: '', setAttribute: (_k, v) => (meta.content = v) };
	vi.stubGlobal('$state', <T>(v: T) => v);
	vi.stubGlobal('localStorage', {
		getItem: (k: string) => store.get(k) ?? null,
		setItem: (k: string, v: string) => store.set(k, v)
	});
	vi.stubGlobal('document', {
		documentElement: root,
		head: { append: (l: FakeLink) => els.set(l.id, l) },
		getElementById: (id: string) => els.get(id) ?? null,
		createElement: () => new FakeLink(),
		querySelector: (s: string) => (s === 'meta[name="theme-color"]' ? meta : null)
	});
	vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (n: string) => (n === '--bg' ? bg() : '') }));
	vi.stubGlobal(
		'MutationObserver',
		class {
			observe() {}
			disconnect() {}
		}
	);
});

/** Como src/app.html al abrir /os directamente: aspecto puesto, sin data-style ni hoja; la barra, con Mando. */
function openOsDirectly(style: string) {
	store.set('arc-style', style);
	root.dataset.osLook = '1';
	root.dataset.osSkin = 'mando';
	meta.content = BG.mando;
}

describe('al salir de Arc OS, theme-color vuelve al fondo de la estética (look.ts)', () => {
	it('entrando directo en /os: se aparta del aspecto en el acto y queda con el de la estética al cargar su hoja', async () => {
		openOsDirectly('grafito');
		const { osLook } = await import('./look.ts');
		osLook(() => 'mando').stop();
		await vi.waitFor(() => expect(meta.content).toBe(BG.terminal));
		const link = els.get('style-sheet');
		expect(link?.href).toBe('/estilos/grafito.css');
		link?.load();
		expect(meta.content).toBe(BG.grafito);
	});

	it('con Terminal no hay hoja: el color sale en el acto', async () => {
		openOsDirectly('terminal');
		const { osLook } = await import('./look.ts');
		osLook(() => 'mando').stop();
		await vi.waitFor(() => expect(meta.content).toBe(BG.terminal));
		expect(els.has('style-sheet')).toBe(false);
	});

	it('entrando desde la web: la hoja ya cargada vale en cuanto se vuelve a activar, sin esperar a «load»', async () => {
		store.set('arc-style', 'grafito');
		root.dataset.style = 'grafito';
		const link = new FakeLink();
		link.id = 'style-sheet';
		link.href = '/estilos/grafito.css';
		link.loaded = true;
		els.set(link.id, link);
		const { osLook } = await import('./look.ts');
		const look = osLook(() => 'mando');
		expect(link.disabled).toBe(true);
		expect(root.dataset.style).toBeUndefined();
		// Dentro de /os, la barra cogió el fondo del aspecto (p. ej., al cambiar el tema del sistema).
		meta.content = BG.mando;
		look.stop();
		await vi.waitFor(() => expect(meta.content).toBe(BG.grafito));
		expect(link.disabled).toBe(false);
	});

	it('webLook solo (vistas dentro de una ventana, embed.ts) no toca theme-color', async () => {
		store.set('arc-style', 'grafito');
		meta.content = 'sin tocar';
		const { webLook } = await import('./look.ts');
		await webLook(root as unknown as HTMLElement);
		els.get('style-sheet')?.load();
		expect(root.dataset.style).toBe('grafito');
		expect(meta.content).toBe('sin tocar');
	});
});

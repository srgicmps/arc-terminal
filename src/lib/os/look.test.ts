// Al salir de Arc OS, la barra del navegador del móvil (meta theme-color) vuelve al fondo de la estética, con el
// look.ts de verdad sobre un navegador de mentira: <html>, el <link> de la hoja (carga cuando se le dice), el meta y un
// getComputedStyle que da el --bg según lo que se ve. Los tests no pasan por el compilador de Svelte: $state va de
// mentira (theme.svelte.ts lo usa), igual que $app/paths (estilos-css.ts).
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/paths', () => ({ asset: (p: string) => p }));

/** --bg de cada cosa (los de verdad: Mando, Terminal y Grafito de noche). */
const BG = { mando: '#070c12', terminal: '#080a0d', grafito: '#0b0d10' };

/**
 * El <link id="style-sheet">: cambia de href como el de verdad y solo «carga» cuando el test llama a load(). Como en
 * Chromium, al desactivarlo suelta la hoja: al reactivarlo hay que esperar a otro «load».
 */
class FakeLink extends EventTarget {
	id = '';
	rel = '';
	loaded = false;
	#href = '';
	#disabled = false;
	get disabled() {
		return this.#disabled;
	}
	set disabled(v: boolean) {
		this.#disabled = v;
		if (v) this.loaded = false;
	}
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
		setItem: (k: string, v: string) => store.set(k, v),
		get length() {
			return store.size;
		},
		key: (i: number) => [...store.keys()][i] ?? null
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

/** En la web, con la hoja de la estética ya cargada y la barra con su fondo. Devuelve el <link>. */
function onTheWeb(style: keyof typeof BG) {
	store.set('arc-style', style);
	root.dataset.style = style;
	const link = new FakeLink();
	link.id = 'style-sheet';
	link.href = `/estilos/${style}.css`;
	link.loaded = true;
	els.set(link.id, link);
	meta.content = BG[style];
	return link;
}

describe('al entrar en Arc OS desde la web, theme-color pasa al fondo del aspecto (look.ts)', () => {
	it('sin esperar a ninguna hoja: Mando está en tokens.css', async () => {
		onTheWeb('grafito');
		const { osLook } = await import('./look.ts');
		osLook(() => 'mando');
		await vi.waitFor(() => expect(meta.content).toBe(BG.mando));
	});
});

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

	it('entrando desde la web: la hoja se suelta al desactivarla y, al salir, el color bueno llega con su «load»', async () => {
		const link = onTheWeb('grafito');
		const { osLook } = await import('./look.ts');
		const look = osLook(() => 'mando');
		expect(link.disabled).toBe(true);
		expect(link.loaded).toBe(false);
		expect(root.dataset.style).toBeUndefined();
		await vi.waitFor(() => expect(meta.content).toBe(BG.mando));
		look.stop();
		await vi.waitFor(() => expect(meta.content).toBe(BG.terminal));
		expect(link.disabled).toBe(false);
		expect(root.dataset.style).toBe('grafito');
		link.load();
		expect(meta.content).toBe(BG.grafito);
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

describe('webLook solo pone estéticas de ESTILOS; si no, lo mismo que decideStyle (como src/app.html)', () => {
	const web = async () => (await import('./look.ts')).webLook(root as unknown as HTMLElement);

	it('un id que no existe no pide su hoja (daría 404): quien ya usaba la web, Terminal', async () => {
		store.set('arc-style', 'inventada');
		store.set('arc-theme', 'dark');
		await web();
		expect(root.dataset.style).toBe('terminal');
		expect(els.has('style-sheet')).toBe(false);
	});

	it('quien llega nuevo, Grafito (también con «modern», su nombre antiguo)', async () => {
		for (const stored of ['inventada', 'modern']) {
			store.set('arc-style', stored);
			await web();
			expect(root.dataset.style, stored).toBe('grafito');
			expect(els.get('style-sheet')?.href, stored).toBe('/estilos/grafito.css');
		}
	});
});

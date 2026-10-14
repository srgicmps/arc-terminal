// Vista modular: el interruptor «General / Modular» y el diseño de cada vista, guardados en este
// navegador. Como un store de Pinia con persistencia; la lógica está en layout.ts.
import { getContext, setContext } from 'svelte';
import {
	defaults,
	hide,
	move,
	place,
	reconcile,
	setSpan,
	show,
	type Layout,
	type ModuleDef,
	type Span
} from './layout.ts';

export type { ModuleDef, Span } from './layout.ts';

const MODE_KEY = 'arc-mode';

export const mode = $state({ modular: false });

/** Se llama al arrancar en el navegador (desde el layout). */
export function initMode() {
	try {
		mode.modular = localStorage.getItem(MODE_KEY) === 'modular';
	} catch {}
}

export function toggleMode() {
	mode.modular = !mode.modular;
	try {
		localStorage.setItem(MODE_KEY, mode.modular ? 'modular' : 'general');
	} catch {}
}

/** El diseño de una vista (orden, ocultos y anchos), guardado como «arc-layout-<vista>». */
export class ViewLayout {
	layout: Layout = $state({ order: [], hidden: [], span: {} });
	/** Panel que se está arrastrando (escritorio). */
	dragging: string | null = $state(null);
	readonly key: string;
	readonly modules: readonly ModuleDef[];

	constructor(view: string, modules: readonly ModuleDef[]) {
		this.key = `arc-layout-${view}`;
		this.modules = modules;
		this.layout = defaults(modules);
	}

	/** Lee lo guardado. Va en $effect / onMount, no en el constructor, para que el prerender no lo vea. */
	load() {
		try {
			this.layout = reconcile(JSON.parse(localStorage.getItem(this.key) ?? 'null'), this.modules);
		} catch {
			this.layout = defaults(this.modules);
		}
	}

	private set(next: Layout) {
		this.layout = next;
		try {
			localStorage.setItem(this.key, JSON.stringify(next));
		} catch {}
	}

	/** Ids visibles, en orden. (Un getter se recalcula al leerlo, como un computed sin caché.) */
	get visible() {
		return this.layout.order.filter((id) => !this.layout.hidden.includes(id));
	}
	get hidden() {
		return this.modules.filter((m) => this.layout.hidden.includes(m.id));
	}

	title(id: string) {
		return this.modules.find((m) => m.id === id)?.title ?? id;
	}
	span(id: string): Span {
		return this.layout.span[id] ?? 1;
	}
	move(id: string, delta: number) {
		this.set(move(this.layout, id, delta));
	}
	place(id: string, target: string, after = false) {
		this.set(place(this.layout, id, target, after));
	}
	hide(id: string) {
		this.set(hide(this.layout, id));
	}
	show(id: string) {
		this.set(show(this.layout, id));
	}
	setSpan(id: string, span: Span) {
		this.set(setSpan(this.layout, id, span));
	}
	reset() {
		this.layout = defaults(this.modules);
		try {
			localStorage.removeItem(this.key);
		} catch {}
	}
}

// Contexto: <ModularGrid> lo pone y cada <Panel id="…"> de dentro lo lee para mostrar ⋮⋮ y ✕.
// Fuera de una rejilla modular no hay contexto y el panel se ve como siempre.
const KEY = Symbol('modular');

export function setModular(layout: ViewLayout) {
	setContext(KEY, layout);
}

export function getModular(): ViewLayout | undefined {
	return getContext<ViewLayout | undefined>(KEY);
}

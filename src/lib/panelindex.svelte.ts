// Índice de paneles (Mejora continua 5): cada Panel se apunta aquí al montarse y se borra al desmontarse.
// El layout crea el registro con setContext (como provide/inject en Vue) y PanelIndex lo pinta en el móvil.
import { getContext, setContext, untrack } from 'svelte';

const KEY = Symbol('panel-index');

interface Entry {
	id: number;
	title: string;
	el: HTMLElement;
}

export class PanelRegistry {
	items = $state<Entry[]>([]);
	#next = 0;

	/**
	 * Apunta un panel; devuelve la función que lo borra (para el return de un $effect). La lista se lee con
	 * untrack: si no, el $effect del panel dependería de ella y se volvería a lanzar al cambiarla, sin fin.
	 */
	add(title: string, el: HTMLElement) {
		const id = ++this.#next;
		untrack(() => (this.items = [...this.items, { id, title, el }]));
		return () => untrack(() => (this.items = this.items.filter((i) => i.id !== id)));
	}

	/** En el orden en que salen en la página. */
	get ordered() {
		return [...this.items].sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
	}
}

export const setPanelIndex = () => setContext(KEY, new PanelRegistry());
export const getPanelIndex = () => getContext<PanelRegistry | undefined>(KEY);

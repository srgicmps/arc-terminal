// Paneles fijados en TOP, guardados en este navegador («arc-pins»). La lógica está en pins.ts.
import { getContext, setContext } from 'svelte';
import { reconcilePins, setPinSpan, togglePin, type Pinned } from './pins.ts';
import type { Span } from './layout.ts';

const KEY = 'arc-pins';

export const pins = $state({ list: [] as Pinned[] });

/** Lee lo guardado. Va en $effect, no al importar, para que el prerender no lo vea. */
export function loadPins() {
	try {
		pins.list = reconcilePins(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
	} catch {
		pins.list = [];
	}
}

function save(next: Pinned[]) {
	pins.list = next;
	try {
		localStorage.setItem(KEY, JSON.stringify(next));
	} catch {}
}

export const isPinned = (id: string) => pins.list.some((p) => p.id === id);
export const togglePinned = (id: string) => save(togglePin(pins.list, id));
export const pinSpan = (id: string): Span => pins.list.find((p) => p.id === id)?.span ?? 1;
export const setPinnedSpan = (id: string, span: Span) => save(setPinSpan(pins.list, id, span));

// Contexto: <PinnedPanels> lo pone para que el 📌 de sus paneles abra el menú (ancho y quitar)
// en vez de soltar el panel directamente.
const CTX = Symbol('pins');
export const setPinArea = () => setContext(CTX, true);
export const inPinArea = () => getContext<boolean | undefined>(CTX) ?? false;

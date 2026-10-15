// Foco de teclado en Arc OS: lo que se abre por encima del escritorio (menús, paneles, buscador, asistente,
// bloqueo) recibe el foco, no lo deja escapar si tapa la pantalla y, al cerrarse, lo devuelve a quien lo abrió.
// Sin esto, al cerrar con Esc el foco caía al <body> y el siguiente Tab empezaba desde arriba del todo.
// Uso, como una directiva de Vue: <div role="dialog" use:overlay={{ trap: true, onescape: close }}>.

const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), iframe, [tabindex]:not([tabindex="-1"])';

/**
 * ¿Alt (⌥ en el Mac) ha escrito un carácter? En un Mac con teclado español ⌥1 es «|», ⌥2 «@» y ⌥º «\»: con el
 * foco en un campo eso es texto, no un atajo de Arc OS. En Windows y Linux Alt+1 sigue dando «1».
 */
export const altTyped = (key: string) => key.length === 1 && !/^[0-9a-zº`ª<>]$/i.test(key);

type Pt = { x: number; y: number };

/**
 * El punto más cercano a `from` en la dirección `[dx, dy]` (flechas en una rejilla con huecos, como los iconos del
 * escritorio): lo que queda de lado pesa el doble. Devuelve su índice, o -1 si no hay ninguno en esa dirección.
 */
export function nearestIndex(from: Pt, pts: Pt[], [dx, dy]: [number, number]): number {
	let best = -1;
	let score = Infinity;
	pts.forEach((p, i) => {
		const along = (p.x - from.x) * dx + (p.y - from.y) * dy;
		if (along <= 1) return;
		const s = along + 2 * Math.abs((p.x - from.x) * dy + (p.y - from.y) * dx);
		if (s < score) (score = s), (best = i);
	});
	return best;
}

/** Con Tab en un diálogo modal: adónde va el foco (índice) desde `at` (-1 si está fuera), o null si sigue solo. */
export function trapStep(at: number, count: number, back: boolean): number | null {
	if (!count) return null;
	if (back && at <= 0) return count - 1;
	if (!back && (at < 0 || at === count - 1)) return 0;
	return null;
}

/** Lo que se puede enfocar con Tab dentro de `root`, en orden, sin lo oculto ni lo inerte. */
export const focusables = (root: ParentNode): HTMLElement[] =>
	[...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.getClientRects().length > 0 && !e.closest('[inert], [aria-hidden="true"]'));

/** ¿Se ha perdido el foco? (en el <body> o en algo que ya no está en la página). */
const lost = () => {
	const a = document.activeElement;
	return !a || a === document.body || !a.isConnected || !a.checkVisibility({ visibilityProperty: true });
};

const usable = (e: HTMLElement | null): e is HTMLElement => !!e?.isConnected && !e.closest('[inert], [aria-hidden="true"]') && e.getClientRects().length > 0;

/**
 * Devuelve el foco si se ha perdido: a `opener` si sigue a la vista; si no, a un diálogo modal que siga abierto
 * (el asistente, debajo del bloqueo), a la ventana activa o al escritorio. Espera a que Svelte quite lo que se cierra.
 */
export function restoreFocus(opener: HTMLElement | null) {
	setTimeout(() => {
		if (!lost()) return;
		const modal = document.querySelector<HTMLElement>('[aria-modal="true"]');
		const win = document.querySelector<HTMLElement>('[data-ui="os-win"].active [data-ui="os-title"]');
		const desk = document.querySelector<HTMLElement>('[data-ui="os-icons"]');
		const to = usable(opener) ? opener : modal ? (focusables(modal)[0] ?? modal) : usable(win) ? win : desk;
		to?.focus({ preventScroll: true });
	});
}

export interface OverlayOptions {
	/** Tapa la pantalla (diálogo modal): Tab y ⇧Tab dan la vuelta dentro. */
	trap?: boolean;
	/** Esc cierra. */
	onescape?: () => void;
	/** Al abrirse, el foco va a lo primero que se pueda enfocar (si el componente no lo ha puesto ya dentro). */
	autofocus?: boolean;
}

/** Acción de Svelte para todo lo que se abre por encima: foco al abrir, Tab dentro, Esc y foco de vuelta al cerrar. */
export function overlay(node: HTMLElement, options: OverlayOptions = {}) {
	let opts = options;
	const a = document.activeElement;
	const opener = a instanceof HTMLElement && a !== document.body && !node.contains(a) ? a : null;
	if (opts.autofocus) requestAnimationFrame(() => node.isConnected && !node.contains(document.activeElement) && (focusables(node)[0] ?? node).focus());

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Escape' && opts.onescape) {
			e.preventDefault();
			e.stopPropagation();
			opts.onescape();
			return;
		}
		if (e.key !== 'Tab' || !opts.trap) return;
		const list = focusables(node);
		const to = trapStep(list.indexOf(document.activeElement as HTMLElement), list.length, e.shiftKey);
		if (!list.length || to !== null) e.preventDefault();
		if (to !== null) list[to].focus();
	}
	node.addEventListener('keydown', onkeydown);
	return {
		update: (o: OverlayOptions) => (opts = o),
		destroy() {
			node.removeEventListener('keydown', onkeydown);
			restoreFocus(opener);
		}
	};
}

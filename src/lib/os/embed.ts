// Una vista dentro de una ventana de Arc OS (un iframe con ?embed=1; src/app.html pone <html data-embed> antes
// de pintar y el layout oculta su cabecera). Aquí, lo que la une a la ventana que la contiene:
// - copia el tema y el modo del escritorio, al momento (mismo origen), y sigue la estética, el acento y la
//   densidad guardados: el contenido de las apps sí los usa (el escritorio no, src/lib/os/look.ts);
// - avisa a la ventana cuando la tocas (para traerla al frente) y cuando navegas dentro (para recordar la ruta);
// - le pasa los atajos de Arc OS (Alt + …) para que funcionen también con el foco dentro;
// - le pregunta qué hacer con un enlace interno: si es de otra app, el escritorio la abre en su ventana (onEmbedLink).
// Los mensajes llevan type «arcos:…» y solo se aceptan del mismo origen.

import { webLook } from './look.ts';
import { altTyped } from './focus.ts';
import { isTyping } from '../rownav.ts';

export const isEmbedded = () => typeof document !== 'undefined' && document.documentElement.dataset.embed === '1';

export type EmbedMessage =
	| { type: 'arcos:focus' }
	| { type: 'arcos:path'; path: string }
	| { type: 'arcos:key'; key: string; code: string; alt: boolean; shift: boolean; ctrl: boolean; meta: boolean; up?: boolean };

/** Quita el ?embed=1 de una ruta (para guardarla o abrirla fuera del escritorio). */
export const unembed = (path: string) => path.replace(/([?&])embed=1(&|$)/, (_, a: string, b: string) => (b ? a : '')).replace(/[?&](?=#|$)/, '');

const MIRROR = ['theme', 'modo'] as const;

/** Lo que decide la ventana con un enlace de su vista: true si lo ha abierto ella (en otra ventana). */
type LinkHandler = (path: string) => boolean;
const LINKS = '__arcosLinks';
type Host = Window & { [LINKS]?: Map<Window, LinkHandler> };

/**
 * En el escritorio: la ventana que contiene `frame` decide los enlaces internos de su vista. Se guarda por
 * contentWindow, que es el mismo objeto aunque la vista navegue. Devuelve la limpieza.
 */
export function onEmbedLink(frame: HTMLIFrameElement, fn: LinkHandler) {
	const w = frame.contentWindow;
	if (!w) return;
	const map = ((window as Host)[LINKS] ??= new Map());
	map.set(w, fn);
	return () => map.get(w) === fn && map.delete(w);
}

/** Un clic normal en un enlace de la misma web (sin Ctrl, ⌘, Mayús ni target): su ruta, o null. */
export function internalLink(e: MouseEvent, origin = location.origin): string | null {
	if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return null;
	const a = (e.target as Element | null)?.closest?.('a[href]');
	if (!(a instanceof HTMLAnchorElement) || (a.target && a.target !== '_self') || a.hasAttribute('download')) return null;
	const url = new URL(a.href, location.href);
	return url.origin === origin ? url.pathname + url.search + url.hash : null;
}

function send(msg: EmbedMessage) {
	try {
		if (window.parent !== window) window.parent.postMessage(msg, location.origin);
	} catch {}
}

/** La ruta de la vista, sin el ?embed=1, para guardarla en la ventana. */
export const reportPath = (path: string) => isEmbedded() && send({ type: 'arcos:path', path });

/** Se llama una vez desde +layout.svelte; no hace nada fuera de una ventana. Devuelve la limpieza. */
export function initEmbed() {
	if (!isEmbedded()) return;
	let host: Document;
	try {
		host = window.parent.document; // falla si el padre es de otro origen: entonces solo se oculta la cabecera
	} catch {
		return;
	}
	const root = document.documentElement;
	const copy = () => {
		for (const k of MIRROR) {
			const v = host.documentElement.dataset[k];
			if (v === undefined) delete root.dataset[k];
			else if (root.dataset[k] !== v) root.dataset[k] = v;
		}
	};
	copy();
	const watch = new MutationObserver(copy);
	watch.observe(host.documentElement, { attributes: true, attributeFilter: MIRROR.map((k) => `data-${k}`) });
	// La estética cambiada en otra ventana (ESTILO, HELP) llega aquí como evento storage.
	const onStorage = (e: StorageEvent) => {
		if (e.key === null || e.key === 'arc-style' || e.key === 'arc-accent' || e.key === 'arc-density') webLook(root);
	};
	window.addEventListener('storage', onStorage);
	const onDown = () => send({ type: 'arcos:focus' });
	// En captura: antes que el enrutador de SvelteKit, que navegaría dentro de la ventana.
	const onClick = (e: MouseEvent) => {
		const path = internalLink(e);
		if (path !== null && (window.parent as Host)[LINKS]?.get(window)?.(path)) e.preventDefault();
	};
	// Los atajos del escritorio: Alt + …, ⌘ + flechas y Ctrl/⌘ + Espacio (buscador). Soltar Alt también (cierra Alt+Tab).
	const isOsKey = (e: KeyboardEvent) => e.altKey || (e.metaKey && e.key.startsWith('Arrow')) || (e.code === 'Space' && (e.ctrlKey || e.metaKey));
	const forward = (e: KeyboardEvent, up = false) =>
		send({ type: 'arcos:key', key: e.key, code: e.code, alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey, ...(up && { up }) });
	const onKey = (e: KeyboardEvent) => {
		if (!isOsKey(e)) return;
		// ⌥ escribiendo en un campo (Mac): «@», «|»… son texto, no atajos de Arc OS.
		if (altTyped(e.key) && isTyping(document.activeElement)) return;
		if (e.code === 'Space') e.preventDefault();
		forward(e);
	};
	const onKeyUp = (e: KeyboardEvent) => e.key === 'Alt' && forward(e, true);
	window.addEventListener('pointerdown', onDown, true);
	window.addEventListener('keydown', onKey, true);
	window.addEventListener('keyup', onKeyUp, true);
	window.addEventListener('click', onClick, true);
	return () => {
		watch.disconnect();
		window.removeEventListener('storage', onStorage);
		window.removeEventListener('pointerdown', onDown, true);
		window.removeEventListener('keydown', onKey, true);
		window.removeEventListener('keyup', onKeyUp, true);
		window.removeEventListener('click', onClick, true);
	};
}

// Una vista dentro de una ventana de Arc OS (un iframe con ?embed=1; src/app.html pone <html data-embed> antes
// de pintar y el layout oculta su cabecera). Aquí, lo que la une a la ventana que la contiene:
// - copia el tema, la estética, el acento, la densidad y el modo del escritorio, al momento (mismo origen);
// - avisa a la ventana cuando la tocas (para traerla al frente) y cuando navegas dentro (para recordar la ruta);
// - le pasa los atajos de Arc OS (Alt + …) para que funcionen también con el foco dentro.
// Los mensajes llevan type «arcos:…» y solo se aceptan del mismo origen.

export const isEmbedded = () => typeof document !== 'undefined' && document.documentElement.dataset.embed === '1';

export type EmbedMessage =
	| { type: 'arcos:focus' }
	| { type: 'arcos:path'; path: string }
	| { type: 'arcos:key'; key: string; code: string; alt: boolean; shift: boolean; ctrl: boolean; meta: boolean };

/** Quita el ?embed=1 de una ruta (para guardarla o abrirla fuera del escritorio). */
export const unembed = (path: string) => path.replace(/([?&])embed=1(&|$)/, (_, a: string, b: string) => (b ? a : '')).replace(/[?&](?=#|$)/, '');

const MIRROR = ['theme', 'style', 'accent', 'density', 'modo'] as const;

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
		// La hoja de la estética (src/lib/estilos.ts la cambia en el escritorio): la misma aquí.
		const want = host.getElementById('style-sheet') as HTMLLinkElement | null;
		const have = document.getElementById('style-sheet') as HTMLLinkElement | null;
		if (!want) have?.remove();
		else if (!have) {
			const link = document.createElement('link');
			link.id = 'style-sheet';
			link.rel = 'stylesheet';
			link.href = want.href;
			document.head.appendChild(link);
		} else if (have.href !== want.href) have.href = want.href;
	};
	copy();
	const watch = new MutationObserver(copy);
	watch.observe(host.documentElement, { attributes: true, attributeFilter: MIRROR.map((k) => `data-${k}`) });
	watch.observe(host.head, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
	const onDown = () => send({ type: 'arcos:focus' });
	const onKey = (e: KeyboardEvent) => {
		if (!e.altKey) return;
		send({ type: 'arcos:key', key: e.key, code: e.code, alt: e.altKey, shift: e.shiftKey, ctrl: e.ctrlKey, meta: e.metaKey });
	};
	window.addEventListener('pointerdown', onDown, true);
	window.addEventListener('keydown', onKey, true);
	return () => {
		watch.disconnect();
		window.removeEventListener('pointerdown', onDown, true);
		window.removeEventListener('keydown', onKey, true);
	};
}

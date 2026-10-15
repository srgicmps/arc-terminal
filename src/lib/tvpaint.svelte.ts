// Aviso de «han cambiado los colores» para lo que tiene que escribirlos a mano (TradingView no entiende variables
// CSS). Cambian con el tema, el acento o la estética: <html data-theme|data-accent|data-style> y, en una estética,
// cuando llega su hoja (static/estilos/<id>.css, que se carga aparte y tarda un poco).
export const paint = $state({ n: 0 });

let started = false;

/** Empieza a vigilar (una vez por página; se llama desde los componentes en el navegador). */
export function watchPaint() {
	if (started || typeof MutationObserver === 'undefined') return;
	started = true;
	const bump = () => paint.n++;
	new MutationObserver(bump).observe(document.documentElement, { attributeFilter: ['data-theme', 'data-accent', 'data-style'] });
	// Los «load» de <link> no suben por el árbol: se escuchan en la fase de captura.
	document.addEventListener('load', (e) => e.target instanceof HTMLLinkElement && e.target.rel === 'stylesheet' && bump(), true);
}

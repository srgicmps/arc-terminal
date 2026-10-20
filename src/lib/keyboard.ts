/**
 * Teclado en pantalla del móvil. En iOS lo fijo (position: fixed) se coloca respecto a la ventana entera, que no
 * encoge al salir el teclado: lo de abajo queda tapado. visualViewport dice qué trozo se ve de verdad.
 * Misma regla que keyboardFit de Arc OS (src/lib/os/mobile/home.ts), copiada para no depender de Arc OS.
 */

/** Lo justo de visualViewport (así se prueba sin navegador). */
export type VisualViewportLike = { height: number; offsetTop: number; scale: number };

/**
 * Con el teclado abierto: `bottom`, lo que tapa por abajo (px desde el borde de abajo de la ventana), y `h`, el alto
 * que queda a la vista. null sin teclado (menos de 120 px de diferencia: la barra del navegador que se esconde no
 * cuenta) o con zoom de pellizco (entonces manda el navegador).
 */
export function keyboardInset(vv: VisualViewportLike, innerHeight: number): { bottom: number; h: number } | null {
	if (Math.abs(vv.scale - 1) >= 0.01 || innerHeight - vv.height <= 120) return null;
	return { bottom: Math.max(0, Math.round(innerHeight - vv.height - vv.offsetTop)), h: Math.round(vv.height) };
}

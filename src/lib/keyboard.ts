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

/**
 * Alto para las sugerencias de la hoja de la barra de comandos: lo que queda a la vista (`kb.h`) menos lo que la hoja
 * deja debajo dentro de lo visible. La hoja va en max(barra inferior, teclado): si el teclado tapa menos que la barra
 * de pestañas (iOS desplaza lo que se ve y `kb.bottom` sale pequeño), entre el borde de abajo de lo visible y la hoja
 * queda la barra, y eso no es sitio para la lista. `under`: px del borde de abajo de la ventana al de la hoja, medido.
 */
export function sheetRoom(kb: { bottom: number; h: number }, under: number): number {
	return Math.max(0, kb.h - Math.max(0, Math.round(under - kb.bottom)));
}

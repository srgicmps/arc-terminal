// «Nuevo desde tu última visita». Como un store de Pinia con persistencia, pero con una regla:
// la marca NO se mueve mientras lees, para que los titulares sigan marcados como nuevos.
//
// - Al abrir la terminal, `visit.last` es la hora en que la dejaste la última vez (null la primera vez).
// - Al ocultar la pestaña (cambiar de app, bloquear el móvil) o al cerrarla, se guarda «ahora» como
//   nueva marca en localStorage. Las navegaciones internas (TOP → GEO) no cuentan.
// - Recargar la pestaña conserva la referencia (va también en sessionStorage).
// - Si vuelves a la pestaña tras más de 30 min oculta, cuenta como visita nueva: la referencia pasa a
//   ser el momento en que la ocultaste.
import { AWAY_MS, KEY, SESSION_KEY, startingPoint, storage, writeStamp } from './visit.ts';

export { isNew, newCount, newSinceText } from './visit.ts';

export const visit = $state({
	/** Hora ISO de la visita anterior, o null si es la primera (o aún no ha arrancado). */
	last: null as string | null,
	/** false durante el prerender y hasta que arranca en el navegador. */
	ready: false
});

let hiddenAt = 0;

/**
 * Se llama al montar las vistas que lo usan (NewsList, TOP…); la segunda vez no hace nada. Va en
 * onMount / $effect y no al importar el módulo, para que el HTML prerenderizado y el primer pintado
 * del navegador coincidan (sin puntos) y no haya desajustes al hidratar.
 */
export function initVisit() {
	if (visit.ready || typeof document === 'undefined') return;
	const local = storage('localStorage');
	const session = storage('sessionStorage');
	visit.last = startingPoint(local, session);
	visit.ready = true;

	const stamp = () => writeStamp(local, new Date().toISOString(), KEY);

	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') {
			hiddenAt = Date.now();
			stamp();
		} else if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) {
			visit.last = new Date(hiddenAt).toISOString();
			writeStamp(session, visit.last, SESSION_KEY);
			hiddenAt = 0;
		}
	});
	addEventListener('pagehide', stamp);
}

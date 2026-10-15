// Cinta de cotizaciones de la cabecera: a la vista (lo de siempre) o plegada, para quien quiera menos ruido.
// Se cambia en «⋯» de la cabecera y se guarda en este navegador (cada dispositivo, a su gusto).

const KEY = 'arc-tape-on';

export const tape = $state({ on: true });

/** Se llama al arrancar en el navegador (desde el layout). */
export function initTape() {
	try {
		tape.on = localStorage.getItem(KEY) !== '0';
	} catch {}
}

export function toggleTape() {
	tape.on = !tape.on;
	try {
		if (tape.on) localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, '0');
	} catch {}
}

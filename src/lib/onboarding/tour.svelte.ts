// Estado del recorrido (como un store de Pinia sin persistencia). Lo abren BIENVENIDA (al montar tu Arc) y
// HELP, y cada una pinta <Tour> en su página: así no pesa en las demás vistas.
export const tour = $state({ open: false, step: 0 });

let done: (() => void) | undefined;

/** Abre el recorrido; `then` se llama al cerrarlo (con «Listo», «Saltar» o Esc). */
export function startTour(then?: () => void) {
	done = then;
	tour.step = 0;
	tour.open = true;
}

export function closeTour() {
	tour.open = false;
	const then = done;
	done = undefined;
	then?.();
}

/** Paso siguiente o anterior; pasado el último, se cierra. */
export function stepTour(delta: 1 | -1, total: number) {
	const next = tour.step + delta;
	if (next >= total) closeTour();
	else tour.step = Math.max(0, next);
}

// Estado del recorrido (como un store de Pinia sin persistencia): lo abre la bienvenida o HELP y lo pinta
// <Tour> desde +layout.svelte. Sin los textos (tour.ts): esos se descargan con <Tour>, solo al abrirlo.
export const tour = $state({ open: false, step: 0 });

export function startTour() {
	tour.step = 0;
	tour.open = true;
}

export function closeTour() {
	tour.open = false;
}

/** Paso siguiente o anterior; pasado el último, se cierra. */
export function stepTour(delta: 1 | -1, total: number) {
	const next = tour.step + delta;
	if (next >= total) closeTour();
	else tour.step = Math.max(0, next);
}

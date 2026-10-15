// Estado del recorrido (como un store de Pinia sin persistencia): lo abre la bienvenida o HELP y lo pinta
// <Tour> desde +layout.svelte.
import { TOUR } from './tour.ts';

export const tour = $state({ open: false, step: 0 });

export function startTour() {
	tour.step = 0;
	tour.open = true;
}

export function closeTour() {
	tour.open = false;
}

export function stepTour(delta: 1 | -1) {
	const next = tour.step + delta;
	if (next >= TOUR.length) closeTour();
	else tour.step = Math.max(0, next);
}

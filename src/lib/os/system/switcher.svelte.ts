// Estado del Alt+Tab visual: abierto o no, la lista de ventanas (por uid) y cuál está elegida. Al soltar Alt
// (o, si la tecla se suelta dentro de una ventana y no llega aquí, al poco de la última pulsación) se va a ella.
import { desk, focus } from '../os.svelte.ts';
import { stepIndex, switchOrder } from './switcher.ts';

/** Si Alt se suelta dentro de un iframe no nos enteramos: se elige sola tras este rato sin pulsar. */
const IDLE_MS = 1200;

export const sw = $state({ open: false, uids: [] as string[], idx: 0 });
let timer: ReturnType<typeof setTimeout> | undefined;

const arm = () => {
	clearTimeout(timer);
	timer = setTimeout(commit, IDLE_MS);
};

/** Alt+º / Alt+Tab: abre el selector o avanza (dir -1 con ⇧). Con menos de dos ventanas no hace nada. */
export function switchStep(dir: 1 | -1 = 1) {
	if (!sw.open) {
		const uids = switchOrder(desk().wins).map((w) => w.uid);
		if (uids.length < 2) return;
		sw.uids = uids;
		sw.idx = 0;
		sw.open = true;
	}
	sw.idx = stepIndex(sw.idx, sw.uids.length, dir);
	arm();
}

export function pick(i: number) {
	sw.idx = i;
	commit();
}

export function commit() {
	clearTimeout(timer);
	if (!sw.open) return;
	const uid = sw.uids[sw.idx];
	sw.open = false;
	if (uid) focus(uid);
}

export function cancel() {
	clearTimeout(timer);
	sw.open = false;
}

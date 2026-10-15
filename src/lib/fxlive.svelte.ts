// Cambios del BCE para el conversor de la barra (M46: «100 USD EUR»). La barra está en todas las vistas, así
// que no puede llevarlos en el HTML: se descargan una sola vez (static/data/ecb.json), al escribir la primera
// conversión (CommandBar llama a loadFxRates y pasa fxLive a suggest). Como un store de Pinia con una acción
// de carga perezosa.
import { asset } from '$app/paths';
import type { Dataset } from './data.ts';
import { fxRates, type FxState } from './fx.ts';
import type { Series } from './types.ts';

export const fxLive: FxState = $state({ rates: null, status: 'idle' });

/** Descarga los cambios si aún no están (solo en el navegador). */
export function loadFxRates() {
	if (fxLive.status !== 'idle' || typeof window === 'undefined') return;
	fxLive.status = 'loading';
	fetch(asset('data/ecb.json' as Parameters<typeof asset>[0]))
		.then((res) => (res.ok ? (res.json() as Promise<Dataset<{ series: Series[] }>>) : Promise.reject(new Error(String(res.status)))))
		.then((d) => {
			fxLive.rates = fxRates(d.data.series ?? []);
			fxLive.status = 'ready';
		})
		.catch(() => (fxLive.status = 'error'));
}

// Datos de las respuestas de la barra (lote 27-A). La barra está en todas las vistas, así que no los lleva en
// el HTML: descarga static/data/<nombre>.json la primera vez que una respuesta lo pide, como fxlive.svelte.ts.
// `barData[nombre]`: el `data` del archivo; undefined mientras llega y null si no se ha podido descargar.
import { asset } from '$app/paths';
import type { Dataset } from '../data.ts';

export const barData: Record<string, unknown> = $state({});
const requested = new Set<string>();

/** Descarga los archivos que aún no se han pedido (solo en el navegador). */
export function loadBarData(names: string[]) {
	if (typeof window === 'undefined') return;
	for (const name of names) {
		if (requested.has(name)) continue;
		requested.add(name);
		fetch(asset(`data/${name}.json` as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<Dataset<unknown>>) : Promise.reject(new Error(String(res.status)))))
			.then((d) => (barData[name] = d.data ?? null))
			.catch(() => (barData[name] = null));
	}
}

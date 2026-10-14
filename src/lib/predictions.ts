// Mercados de predicción: cuánto se mueve cada uno en 24 h, para poner arriba lo que más cambia (M40).
import type { Prediction } from './types.ts';

/** El mayor cambio en 24 h de sus opciones, en valor absoluto (tanto por uno); 0 si no se sabe. */
export const maxMove = (e: Prediction) => Math.max(0, ...e.outcomes.map((o) => Math.abs(o.d ?? 0)));

/** Los que más se mueven primero; a igualdad, en el orden en que llegan (por volumen). No cambia la lista. */
export const byMove = (items: Prediction[]) =>
	items
		.map((e, i) => ({ e, i, m: maxMove(e) }))
		.sort((a, b) => b.m - a.m || a.i - b.i)
		.map((x) => x.e);

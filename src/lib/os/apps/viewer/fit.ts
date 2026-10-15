// Geometría del Visor de Arc OS (lógica pura, con tests): cuánto hay que escalar una imagen para que quepa,
// qué caja ocupa una vez girada (para que el scroll y el arrastre lleguen a todas sus esquinas) y los pasos de zoom.

export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 1.25;

/** ¿Va de lado? (90° o 270°: el ancho y el alto se cambian). */
export const sideways = (turn: number) => ((((turn % 360) + 360) % 360) / 90) % 2 === 1;

/**
 * La escala que encaja una imagen de `nw`×`nh` en un hueco de `w`×`h`, ya girada. Nunca la agranda (una
 * imagen pequeña se ve a su tamaño). Sin medidas todavía, 1.
 */
export function fitScale(nw: number, nh: number, w: number, h: number, turn = 0): number {
	if (!(nw > 0 && nh > 0 && w > 0 && h > 0)) return 1;
	const [iw, ih] = sideways(turn) ? [nh, nw] : [nw, nh];
	return Math.min(1, w / iw, h / ih);
}

/** Medidas de la imagen a una escala (`w`, `h`, sin girar) y de la caja que ocupa ya girada (`boxW`, `boxH`). */
export function frame(nw: number, nh: number, scale: number, turn = 0) {
	const w = Math.round(nw * scale);
	const h = Math.round(nh * scale);
	return sideways(turn) ? { w, h, boxW: h, boxH: w } : { w, h, boxW: w, boxH: h };
}

/** Un paso de zoom desde la escala actual (`dir` 1 acerca, -1 aleja), dentro de los topes. */
export function zoomStep(scale: number, dir: 1 | -1): number {
	const next = dir > 0 ? scale * ZOOM_STEP : scale / ZOOM_STEP;
	return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
}

/**
 * El scroll que deja el mismo punto bajo el centro (o bajo el puntero, `at` en px desde la esquina del hueco)
 * al pasar de un tamaño de caja a otro. `view` es el tamaño visible del hueco.
 */
export function keepPoint(scroll: number, view: number, before: number, after: number, at = view / 2): number {
	if (before <= 0) return 0;
	// Si la caja era menor que el hueco, estaba centrada: el punto relativo sale de ahí.
	const offset = before < view ? (view - before) / 2 : 0;
	const rel = (scroll + at - offset) / before;
	const pos = rel * after - at;
	return Math.max(0, Math.min(Math.max(0, after - view), pos));
}

/** «12 KB», «1,5 MB». */
export const fileSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

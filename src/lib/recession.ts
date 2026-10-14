// ECO, «Señales de recesión» (provisional): tres series de FRED con una regla sencilla cada una para decir si
// la señal está «activada». No es una predicción: son reglas conocidas, escritas tal cual.
//
// - Regla de Sahm (SAHMREALTIME): la media de 3 meses del paro, menos su mínimo de los 12 meses anteriores.
//   Claudia Sahm la fijó en 0,50 puntos: al llegar ahí, la economía de EE. UU. ya suele estar en recesión.
// - Probabilidad de recesión (RECPROUSM156N): modelo de Chauvet y Piger, suavizado y con 2–3 meses de retraso.
//   Se toma el 50 % (más probable que sí que no); hay quien exige el 80 % para dar por empezada una recesión.
// - Curva 10 años − 3 meses (T10Y3M): invertida (negativa) antes de casi todas las recesiones desde 1970, con
//   uno o dos años de adelanto. Para que un solo día no la active, se mira la media de las últimas 20 sesiones
//   (un mes de mercado).
import type { Series } from './types.ts';

export const SAHM_THRESHOLD = 0.5;
export const PROB_THRESHOLD = 50;
/** Sesiones que se promedian para la curva. */
export const CURVE_DAYS = 20;

export interface RecessionSignal {
	name: string;
	/** Último dato. */
	value: number;
	/** Su periodo: «2026-09» o «2026-10-13». */
	t: string;
	active: boolean;
	/** La regla, en una línea. */
	rule: string;
	url: string;
	/** Puntos para el minigráfico. */
	values: number[];
}

export interface RecessionSignals {
	sahm: RecessionSignal | null;
	prob: RecessionSignal | null;
	curve: RecessionSignal | null;
}

type Maybe = Series | null | undefined;

function signal(s: Maybe, name: string, rule: string, active: (values: number[]) => boolean): RecessionSignal | null {
	const values = (s?.points ?? []).map((p) => p.v).filter(Number.isFinite);
	const last = s?.points.at(-1);
	if (!s || !last || !values.length) return null;
	return { name, value: last.v, t: last.t, active: active(values), rule, url: s.url ?? '', values };
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Las tres señales; null en la que falte su serie o no tenga puntos. */
export function recessionSignals(sahm: Maybe, prob: Maybe, curve: Maybe): RecessionSignals {
	return {
		sahm: signal(sahm, 'Regla de Sahm', 'Se activa a partir de 0,50 puntos', (v) => v.at(-1)! >= SAHM_THRESHOLD),
		prob: signal(prob, 'Probabilidad de recesión', 'Se activa a partir del 50 %', (v) => v.at(-1)! >= PROB_THRESHOLD),
		curve: signal(curve, 'Curva 10 años − 3 meses', `Se activa si la media de ${CURVE_DAYS} sesiones es negativa`, (v) => mean(v.slice(-CURVE_DAYS)) < 0)
	};
}

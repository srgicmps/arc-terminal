// Cabina (experiencia /x/cabina): relojes con aguja y zonas. Lógica pura: dónde cae la aguja y en qué zona.
// Las zonas siguen la regla del semáforo de riesgo (risk-lights.ts): calma, vigilar y tensión, sin verde ni rojo
// (esos quedan para subidas y bajadas).

export type Level = 'calm' | 'watch' | 'stress';

export interface GaugeDef {
	id: string;
	label: string;
	/** Id de la cifra del día (figures.ts) de donde sale el valor; «luz» y «riesgo» se calculan aparte. */
	figure?: string;
	min: number;
	max: number;
	/** Zonas de abajo arriba: hasta `to`, este nivel. La última llega al máximo. */
	zones: { to: number; level: Level }[];
	/** Qué quiere decir cada zona, en corto (calma, vigilar, tensión). */
	meaning: Record<Level, string>;
}

export const GAUGES: GaugeDef[] = [
	{ id: 'riesgo', label: 'Apetito de riesgo', min: -100, max: 100, zones: [{ to: -40, level: 'stress' }, { to: -10, level: 'watch' }, { to: 100, level: 'calm' }], meaning: { stress: 'Huida del riesgo', watch: 'Prudencia', calm: 'Mercado tranquilo' } },
	{ id: 'ipc', label: 'Inflación España', figure: 'ipc-es', min: -1, max: 8, zones: [{ to: 0.5, level: 'watch' }, { to: 3, level: 'calm' }, { to: 5, level: 'watch' }, { to: 8, level: 'stress' }], meaning: { calm: 'Cerca del 2 %', watch: 'Fuera de lo normal', stress: 'Precios disparados' } },
	{ id: 'bce', label: 'Tipo del BCE', figure: 'bce', min: -1, max: 6, zones: [{ to: 2.75, level: 'calm' }, { to: 4, level: 'watch' }, { to: 6, level: 'stress' }], meaning: { calm: 'Tipos normales', watch: 'Dinero caro', stress: 'Dinero muy caro' } },
	{ id: 'euribor', label: 'Euríbor 12 m', figure: 'euribor', min: -1, max: 6, zones: [{ to: 2, level: 'calm' }, { to: 3.5, level: 'watch' }, { to: 6, level: 'stress' }], meaning: { calm: 'Hipotecas baratas', watch: 'Hipotecas medias', stress: 'Hipotecas caras' } },
	{ id: 'vix', label: 'VIX (miedo)', figure: 'vix', min: 10, max: 50, zones: [{ to: 20, level: 'calm' }, { to: 30, level: 'watch' }, { to: 50, level: 'stress' }], meaning: { calm: 'Calma', watch: 'Nervios', stress: 'Miedo' } },
	{ id: 'wti', label: 'Petróleo WTI', figure: 'wti', min: 30, max: 130, zones: [{ to: 75, level: 'calm' }, { to: 95, level: 'watch' }, { to: 130, level: 'stress' }], meaning: { calm: 'Barato', watch: 'Caro', stress: 'Muy caro' } },
	{ id: 'luz', label: 'Luz ahora (PVPC)', min: 0, max: 0.3, zones: [{ to: 0.1, level: 'calm' }, { to: 0.18, level: 'watch' }, { to: 0.3, level: 'stress' }], meaning: { calm: 'Buena hora', watch: 'Precio medio', stress: 'Hora cara' } },
	{ id: 'paro', label: 'Paro España', figure: 'paro-es', min: 0, max: 25, zones: [{ to: 8, level: 'calm' }, { to: 14, level: 'watch' }, { to: 25, level: 'stress' }], meaning: { calm: 'Bajo', watch: 'Alto', stress: 'Muy alto' } },
	{ id: 'prima', label: 'Prima de riesgo', figure: 'prima', min: 0, max: 400, zones: [{ to: 100, level: 'calm' }, { to: 250, level: 'watch' }, { to: 400, level: 'stress' }], meaning: { calm: 'Confianza', watch: 'Dudas', stress: 'Desconfianza' } }
];

/** De 0 (mínimo) a 1 (máximo), sin salirse. */
export const fraction = (g: Pick<GaugeDef, 'min' | 'max'>, v: number) => Math.max(0, Math.min(1, (v - g.min) / (g.max - g.min)));

export const levelOf = (g: Pick<GaugeDef, 'zones'>, v: number): Level => (g.zones.find((z) => v <= z.to) ?? g.zones.at(-1)!).level;

/** Ángulo de la aguja en grados: −90 (mínimo, a la izquierda) a 90 (máximo, a la derecha). */
export const needleAngle = (g: Pick<GaugeDef, 'min' | 'max'>, v: number) => -90 + 180 * fraction(g, v);

/** Arco SVG de un tramo de la esfera (de `from` a `to` en fracción), centro (cx, cy) y radio r. */
export function arcPath(from: number, to: number, r: number, cx = 0, cy = 0): string {
	const pt = (f: number) => {
		const a = Math.PI * (1 - f);
		const n = (x: number) => (Math.abs(x) < 0.005 ? 0 : x).toFixed(2);
		return `${n(cx + r * Math.cos(a))} ${n(cy - r * Math.sin(a))}`;
	};
	return `M ${pt(from)} A ${r} ${r} 0 0 1 ${pt(to)}`;
}

/** Los tramos de la esfera, en fracción. */
export function zoneArcs(g: GaugeDef): { from: number; to: number; level: Level }[] {
	let from = 0;
	return g.zones.map((z) => {
		const to = fraction(g, z.to);
		const out = { from, to, level: z.level };
		from = to;
		return out;
	});
}

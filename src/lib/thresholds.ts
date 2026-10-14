// Umbrales visuales (lote 25): «resáltame si pasa de X» en cualquier serie de SeriesTable. Lógica pura,
// para probarla con Vitest; el estado guardado está en thresholds.svelte.ts. Sin avisos al móvil.

export interface Rule {
	/** '>' resalta si el último dato pasa por encima de v; '<', si baja de v. */
	op: '>' | '<';
	v: number;
	/** Nombre de la fila, para el contador de la barra. */
	name: string;
	/** Último dato visto (al pintar la tabla), para contar los que están cruzados en cualquier vista. */
	last?: number;
}

export type Rules = Record<string, Rule>;

export const crossed = (rule: Rule, value: number) => (rule.op === '>' ? value > rule.v : value < rule.v);

/** Las reglas cruzadas según el último dato visto. */
export const hits = (rules: Rules) =>
	Object.entries(rules).filter(([, r]) => r.last !== undefined && crossed(r, r.last));

/** Lo guardado, limpio: solo reglas bien formadas. */
export function cleanRules(data: unknown): Rules {
	if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
	const out: Rules = {};
	for (const [id, r] of Object.entries(data as Record<string, unknown>)) {
		if (!r || typeof r !== 'object') continue;
		const { op, v, name, last } = r as Partial<Rule>;
		if ((op !== '>' && op !== '<') || typeof v !== 'number' || !Number.isFinite(v)) continue;
		out[id] = { op, v, name: typeof name === 'string' ? name : id, ...(typeof last === 'number' ? { last } : {}) };
	}
	return out;
}

/** «1,5» o «1.5» → 1.5; null si no es un número. */
export function parseNumber(text: string): number | null {
	const t = text.trim().replace(/\s/g, '').replace(',', '.');
	if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
	return Number(t);
}

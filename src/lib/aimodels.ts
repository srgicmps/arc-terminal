// Modelos de IA nuevos del mes y su precio, de la lista pública de OpenRouter (https://openrouter.ai/api/v1/models,
// sin clave). Sin imports de Vite: lo usa también el script de Node.

export interface AiModel {
	id: string;
	name: string;
	/** Laboratorio, de la primera parte del id: «anthropic/claude-…» → «anthropic». */
	lab: string;
	/** Día en que entró en OpenRouter: «2026-10-14». */
	date: string;
	/** Tokens de contexto. */
	context: number | null;
	/** Dólares por millón de tokens de entrada y de salida; 0 si es gratis, null si no lo dice. */
	input: number | null;
	output: number | null;
	url: string;
}

interface Raw {
	id?: string;
	name?: string;
	created?: number;
	context_length?: number;
	pricing?: { prompt?: string; completion?: string };
}

/** «0.000003» (dólares por token) → 3 (dólares por millón). */
function perMillion(v: string | undefined): number | null {
	const n = Number(v);
	return v === undefined || !Number.isFinite(n) || n < 0 ? null : Math.round(n * 1e6 * 100) / 100;
}

/**
 * Los modelos que entraron en los últimos `days` días antes de `now`, del más nuevo al más antiguo. Las variantes
 * gratuitas («…:free») se saltan si también está el modelo de pago.
 */
export function parseAiModels(raw: Raw[], now: number, days = 31, max = 15): AiModel[] {
	const since = now / 1000 - days * 86_400;
	const ids = new Set(raw.map((m) => m.id));
	return raw
		.filter((m) => m.id && m.name && typeof m.created === 'number' && m.created >= since)
		.filter((m) => !(m.id!.endsWith(':free') && ids.has(m.id!.slice(0, -5))))
		.sort((a, b) => b.created! - a.created!)
		.slice(0, max)
		.map((m) => ({
			id: m.id!,
			// OpenRouter pone «Laboratorio: Modelo»; el laboratorio ya va aparte.
			name: m.name!.replace(/^[^:]+:\s*/, ''),
			lab: m.id!.split('/')[0],
			date: new Date(m.created! * 1000).toISOString().slice(0, 10),
			context: typeof m.context_length === 'number' ? m.context_length : null,
			input: perMillion(m.pricing?.prompt),
			output: perMillion(m.pricing?.completion),
			url: `https://openrouter.ai/${m.id!.replace(/:free$/, '')}`
		}));
}

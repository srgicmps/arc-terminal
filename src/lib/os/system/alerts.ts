// Avisos de Arc como toasts del sistema: los mismos P1–P4 que salen al móvil, leídos del historial público
// (/data/notify-log.json, que solo lleva ids, horas y niveles; nunca el tema de ntfy). De cada id se saca un
// título legible y a dónde lleva. Lógica pura; el sondeo y el toast van en SystemLayer con notify() de la shell.

export type Level = 1 | 2 | 3 | 4;

export interface LogEntry {
	k: string;
	t: string;
	s: 'sent' | 'failed' | 'baseline';
	p?: Level;
}

export interface AlertToast {
	id: string;
	title: string;
	detail: string;
	href: string;
	level: Level;
	time: string;
}

/** Prefijo del id → tema, a dónde lleva y cómo se nombra lo de detrás de los dos puntos. */
const KINDS: Record<string, { label: string; href: string; what?: (rest: string[]) => string }> = {
	quake: { label: 'Terremoto', href: '/geo' },
	imp: { label: 'Lo más importante', href: '/imp' },
	mkt: { label: 'Mercados', href: '/ws', what: ([a]) => (a === 'grupo' ? 'varios a la vez' : a) },
	stock: { label: 'Tus valores', href: '/mis', what: ([s]) => (s === 'grupo' ? 'varios a la vez' : s) },
	earn: { label: 'Resultados', href: '/cal', what: ([s]) => s },
	macro: { label: 'Dato macro', href: '/eco', what: ([m]) => m.toUpperCase() },
	rate: { label: 'Tipos de interés', href: '/eco' },
	vix: { label: 'Volatilidad (VIX)', href: '/ws' },
	'vix-inv': { label: 'Volatilidad (VIX)', href: '/ws' },
	hy: { label: 'Bonos basura', href: '/ws' },
	liquidity: { label: 'Liquidez', href: '/btmm' },
	auction: { label: 'Subasta del Tesoro', href: '/wb' },
	strait: { label: 'Estrechos', href: '/geo' },
	eia: { label: 'Petróleo (EIA)', href: '/ws' },
	gas: { label: 'Gas', href: '/ws' },
	luz: { label: 'Luz de mañana', href: '/luz' },
	poly: { label: 'Apuestas (Polymarket)', href: '/geo' },
	vote: { label: 'Elecciones', href: '/geo' },
	'vote-result': { label: 'Elecciones', href: '/geo' },
	ai: { label: 'IA', href: '/ai' },
	fedreg: { label: 'Federal Register', href: '/usgov' },
	down: { label: 'Fuente caída', href: '/status', what: ([s]) => s }
};

/** Cómo se enseña un aviso del historial, o null si no se sabe (o no es para enseñar: el diésel es de una zona). */
export function describeAlert(e: LogEntry): AlertToast | null {
	const [head, ...rest] = e.k.split(':');
	const kind = KINDS[head];
	if (!kind || e.s !== 'sent') return null;
	const what = kind.what?.(rest);
	return {
		id: `alert:${e.k}`,
		title: what ? `${kind.label} · ${what}` : kind.label,
		detail: `Aviso P${e.p ?? 3} de Arc`,
		href: kind.href,
		level: e.p ?? 3,
		time: e.t
	};
}

/**
 * Los avisos nuevos desde `since` (ISO), de nivel `maxLevel` o más urgente, del más reciente al más antiguo y
 * como mucho `max`. La primera vez (`since` null) no sale ninguno: solo se toma la hora, para no inundar.
 */
export function freshAlerts(entries: readonly LogEntry[], since: string | null, maxLevel: Level = 2, max = 3): AlertToast[] {
	if (since === null) return [];
	return entries
		.filter((e) => e.t > since && (e.p ?? 3) <= maxLevel)
		.map(describeAlert)
		.filter((a): a is AlertToast => !!a)
		.sort((a, b) => b.time.localeCompare(a.time))
		.slice(0, max);
}

/** La hora del último intento del historial (para la siguiente vuelta). */
export const lastTime = (entries: readonly LogEntry[]) => entries.reduce((m, e) => (e.t > m ? e.t : m), '');

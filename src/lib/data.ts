// Lectura de los datos descargados por scripts/update.ts (static/data/<nombre>.json).

/** Lo que guarda cada archivo de static/data: los datos y cuándo se descargaron. */
export interface Dataset<T> {
	name: string;
	/** Cuándo se descargaron (ISO 8601). */
	fetchedAt: string;
	data: T;
}

/** Estado de cada fuente en la última actualización (static/data/status.json). */
export interface SourceStatus {
	name: string;
	label: string;
	/**
	 * ok: recién descargada · cached: copia reciente reutilizada · stale: falló y se usa la anterior ·
	 * error: sin datos · off: necesita una clave que no está configurada
	 */
	state: 'ok' | 'cached' | 'stale' | 'error' | 'off';
	fetchedAt: string | null;
	/** Cada cuánto se refresca como mucho (maxAgeMinutes de scripts/sources). Lo usa <Updated>. */
	maxAgeMinutes?: number;
	error?: string;
	/** Clave de GitHub Secrets que necesita, si necesita alguna. */
	requires?: string;
}

/**
 * Un tramo del historial: desde `t`, la fuente estuvo en `state` durante `runs` pasadas seguidas.
 * Solo se abre un tramo nuevo cuando cambia el estado, así que hay pocas entradas por fuente.
 */
export interface StateSpan {
	/** Primera pasada del tramo (ISO 8601, al minuto: «2026-10-14T12:07Z»). */
	t: string;
	state: SourceStatus['state'];
	runs: number;
}

/** Historial de 7 días de una fuente (static/data/status-history.json; solo lo carga STATUS). */
export interface SourceHistory {
	name: string;
	/** Última pasada (ISO 8601, al minuto). */
	lastRun: string;
	/** Tramos, del más antiguo al más reciente. */
	history: StateSpan[];
}

/**
 * Estados de las últimas `n` pasadas, de la más antigua a la más reciente, reconstruidos a partir de
 * los tramos (cada tramo aporta `runs` pasadas). Si el historial es más corto, devuelve menos.
 */
export function lastRuns(spans: StateSpan[] | undefined, n: number): SourceStatus['state'][] {
	const out: SourceStatus['state'][] = [];
	for (let i = (spans?.length ?? 0) - 1; i >= 0 && out.length < n; i--) {
		const span = spans![i];
		const runs = Math.max(0, Math.floor(Number(span.runs) || 0));
		for (let k = 0; k < runs && out.length < n; k++) out.push(span.state);
	}
	return out.reverse();
}

// Lo usan los +page.server.ts, que solo se ejecutan al construir la web: el navegador nunca descarga estos
// JSON enteros, sino el recorte que devuelve cada load (va dentro del HTML y en __data.json).
// No importes dataset() desde un componente: metería todos los JSON en la build del navegador.
// Si un archivo no existe (en local, antes de `pnpm data`), simplemente no aparece aquí.
const loaders = import.meta.glob('/static/data/*.json', { import: 'default' });

export async function dataset<T>(name: string): Promise<Dataset<T> | null> {
	const load = loaders[`/static/data/${name}.json`];
	return load ? ((await load()) as Dataset<T>) : null;
}

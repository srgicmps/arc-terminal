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

// Lo usan los +page.server.ts, que solo se ejecutan al construir la web: el navegador nunca descarga estos
// JSON enteros, sino el recorte que devuelve cada load (va dentro del HTML y en __data.json).
// No lo importes desde un componente: metería todos los JSON en la build del navegador.
// Si un archivo no existe (en local, antes de `pnpm data`), simplemente no aparece aquí.
const loaders = import.meta.glob('/static/data/*.json', { import: 'default' });

export async function dataset<T>(name: string): Promise<Dataset<T> | null> {
	const load = loaders[`/static/data/${name}.json`];
	return load ? ((await load()) as Dataset<T>) : null;
}

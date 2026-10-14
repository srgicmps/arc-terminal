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
	/** ok: recién descargada · cached: copia reciente reutilizada · stale: falló y se usa la anterior · error: sin datos */
	state: 'ok' | 'cached' | 'stale' | 'error';
	fetchedAt: string | null;
	error?: string;
}

// Vite convierte cada JSON en un trozo aparte que solo se carga en la página que lo pide.
// Si un archivo no existe (en local, antes de `pnpm data`), simplemente no aparece aquí.
const loaders = import.meta.glob('/static/data/*.json', { import: 'default' });

export async function dataset<T>(name: string): Promise<Dataset<T> | null> {
	const load = loaders[`/static/data/${name}.json`];
	return load ? ((await load()) as Dataset<T>) : null;
}

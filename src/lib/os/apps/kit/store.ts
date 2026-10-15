// Guardar los datos de una app del sistema en localStorage. Si la clave está en prefs.ts como «dato» o «ajuste»,
// cloud.svelte.ts la sube sola a la cuenta (D1) y la trae a los otros dispositivos: aquí no hay nada más que hacer.

export function readJson<T>(key: string, fallback: T, valid: (v: unknown) => v is T): T {
	try {
		const raw = localStorage.getItem(key);
		const v: unknown = raw ? JSON.parse(raw) : null;
		return valid(v) ? v : fallback;
	} catch {
		return fallback;
	}
}

export function writeJson(key: string, value: unknown) {
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {
		// Sin sitio o en privado: la app sigue, sin guardar.
	}
}

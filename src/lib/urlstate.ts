// Estado de la vista en la URL (parte sin Svelte, con tests): un parámetro por cada selector, para que
// un enlace o un favorito abra exactamente lo mismo. El valor por defecto no se escribe: /fuel en vez de
// /fuel?combustible=g95.

/** La misma URL con `name` puesto a `value`, o sin él si `value` es el valor por defecto (o null). */
export function withParam(url: URL, name: string, value: string | null, fallback?: string): URL {
	const next = new URL(url);
	if (value === null || value === fallback) next.searchParams.delete(name);
	else next.searchParams.set(name, value);
	return next;
}

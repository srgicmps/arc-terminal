// Piezas de la vista WX que no comparte nadie más (lógica pura, para probarla con Vitest).

/**
 * Subtítulo de «UV hoy». `window` sale de uvWindow con las horas que quedan (las de air.hours empiezan en la
 * hora actual), así que por la tarde ya no hay ventana aunque al mediodía el UV fuera alto: entonces no se
 * dice «no hace falta protegerse», sino que lo más fuerte ya ha pasado.
 */
export function uvTodaySub(uvMax: number | null | undefined, window: { from: string; to: string } | null): string {
	if (window) return `protégete de ${window.from} a ${window.to}`;
	if (typeof uvMax === 'number' && uvMax >= 2.5) return 'lo más fuerte ya ha pasado';
	return 'no hace falta protegerse';
}

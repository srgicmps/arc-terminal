// «Buscar» de la app Sencilla: temas de la app (con palabras de la calle), empresas y noticias. Lógica pura.
import { hasWords, queryWords } from '../search.ts';

export interface Topic {
	label: string;
	/** Ruta de la app. */
	route: '/app/dinero' | '/app/casa' | '/app/mundo' | '/app/avisos';
	/** Otras formas de decirlo. */
	words: string;
}

export const TOPICS: readonly Topic[] = [
	{ label: 'Inflación (lo que suben los precios)', route: '/app/dinero', words: 'ipc precios carestia vida' },
	{ label: 'Euríbor e hipotecas', route: '/app/dinero', words: 'hipoteca piso casa prestamo cuota interes' },
	{ label: 'Paro', route: '/app/dinero', words: 'desempleo trabajo empleo' },
	{ label: 'Prima de riesgo', route: '/app/dinero', words: 'deuda bonos espana' },
	{ label: 'Euro y dólar', route: '/app/dinero', words: 'divisas cambio moneda viaje' },
	{ label: 'Bitcoin', route: '/app/dinero', words: 'cripto criptomonedas' },
	{ label: 'Tus valores (acciones)', route: '/app/dinero', words: 'bolsa acciones empresas cartera inversion' },
	{ label: 'Luz más barata', route: '/app/casa', words: 'electricidad factura lavadora horas pvpc' },
	{ label: 'Gasolina', route: '/app/casa', words: 'gasolinera diesel combustible repostar coche' },
	{ label: 'El tiempo', route: '/app/casa', words: 'lluvia temperatura calor frio prevision' },
	{ label: 'Aire y polen', route: '/app/casa', words: 'alergia contaminacion polucion uv sol' },
	{ label: 'Noticias', route: '/app/mundo', words: 'titulares actualidad mundo guerra economia tecnologia ia' },
	{ label: 'Avisos al móvil', route: '/app/avisos', words: 'notificaciones alertas resumen manana' }
];

/** Lo que encaja con todas las palabras de `q` (en el texto que da `text`), hasta `limit`. Vacío si no hay búsqueda. */
export function find<T>(q: string, items: readonly T[], text: (t: T) => string, limit = 8): T[] {
	const words = queryWords(q);
	if (!words.length) return [];
	return items.filter((t) => hasWords(text(t), words)).slice(0, limit);
}

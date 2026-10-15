// Modo Sencillo (modo.ts): qué paneles se ven en cada vista y cómo se llaman en español claro.
// Una vista que no está aquí se ve entera. Cada entrada es el título del panel (o lo que va antes de « · ») (sin tildes ni
// mayúsculas, como lo compara `fold`) o «id:…» para los paneles con id (los de TOP, que cambian de título).
// Los paneles fijados en TOP (📌) se ven siempre: los ha elegido el usuario.

export const ESSENTIAL: Record<string, string[]> = {
	'/': ['id:important', 'id:week', 'id:markets', 'id:macro', 'id:rates', 'id:weather', 'id:power', 'id:fuel'],
	'/eco': ['Inflación', 'Paro', 'PIB', 'Bancos centrales', 'Próximas reuniones', 'Tu hipoteca', 'Primas de riesgo', 'Precios de los alimentos', 'Titulares'],
	'/ws': ['Mercados', 'Mapa de calor', 'Los que más se mueven', 'Divisas', 'Conversor', 'Materias primas', 'Cripto', 'Titulares'],
	'/geo': ['Mapa', 'Titulares', 'Próximas elecciones', 'Terremotos en el mundo', 'Huracanes, incendios y volcanes'],
	'/es': ['Titulares', 'España en cifras', 'Paro registrado por comunidad', 'Turismo y vivienda', 'Terremotos en España'],
	'/pais': ['Tus países', 'Países', 'Datos', 'Moneda', 'Luz', 'En las noticias'],
	'/tech': ['Titulares', 'Tecnológicas en bolsa', 'Regulación'],
	'/ai': ['Titulares', 'Tecnológicas en bolsa', 'Modelos nuevos del mes', 'Modelos frontera'],
	'/s': ['Gráfico', 'Cotización', 'Por qué se mueve', 'Perfil de la empresa', 'Datos fundamentales', 'Analistas y resultados', 'En las noticias'],
	'/cal': ['Calendario', 'Próximos datos', 'Resultados', 'Festivos'],
	'/semana': ['Lo más importante', 'Mercados', 'Agenda']
};

/**
 * Títulos con siglas o jerga: en Sencillo se ven así. La clave es el título tal cual (o su principio, hasta « · »).
 * El título de verdad sigue sirviendo para todo lo demás (plegado, «ECO TIPOS», fijar en TOP).
 */
export const PLAIN_TITLES: Record<string, string> = {
	PIB: 'Crecimiento de la economía (PIB)',
	'PIB interanual': 'Crecimiento de la economía (PIB), en un año',
	BCE: 'Banco Central Europeo',
	'EE. UU.': 'Estados Unidos',
	Macro: 'Economía',
	'Tipos y bonos': 'Tipos de interés',
	'Primas de riesgo': 'Prima de riesgo: lo que paga España de más',
	'Bonos a 10 años': 'Lo que pagan los países por su deuda',
	'Mapa de calor': 'Bolsa de hoy, de un vistazo',
	'Los que más se mueven': 'Las acciones que más se mueven',
	'VIX y su curva': 'Miedo en la bolsa (VIX)',
	'Curvas de tipos': 'Tipos de interés a cada plazo',
	'Divisas y cripto': 'Monedas y criptomonedas',
	Divisas: 'Monedas',
	Cripto: 'Criptomonedas',
	'BOE de hoy': 'Boletín Oficial del Estado de hoy',
	'Gasolina 95': 'Gasolina',
	'Modelos frontera': 'Las IA más potentes',
	'Datos fundamentales': 'Las cuentas de la empresa',
	'Analistas y resultados': 'Qué esperan los analistas',
	'Mercados de predicción': 'Apuestas sobre el futuro',
	'Sentimiento económico': 'Confianza en la economía',
	'Diferenciales de crédito': 'Lo que pagan de más las empresas por su deuda',
	'Inflación esperada y tipos reales': 'Inflación que se espera',
	'Mercado monetario': 'Tipos de interés a muy corto plazo',
	'Precios de los alimentos': 'Precio de los alimentos en el mundo'
};

/** Sin tildes, en minúscula y con los espacios normalizados (como glossary.ts). */
export const fold = (s: string) =>
	s
		.normalize('NFD')
		.replace(/\p{M}/gu, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();

const LISTS = Object.fromEntries(Object.entries(ESSENTIAL).map(([route, items]) => [route, items.map((i) => (i.startsWith('id:') ? i : fold(i)))]));

/** ¿Se ve este panel en Sencillo? Vista sin lista: sí. Si no, por id o porque el título es una entrada (o empieza por ella y « · »). */
export function isEssential(route: string | null | undefined, title: string, id?: string): boolean {
	const list = route ? LISTS[route] : undefined;
	if (!list) return true;
	if (id && list.includes(`id:${id}`)) return true;
	const t = fold(title);
	return list.some((i) => !i.startsWith('id:') && (t === i || t.startsWith(i + ' · ')));
}

/** El título en español claro, si lo tiene; si no, el mismo. Lo que va tras « · » se conserva. */
export function plainTitle(title: string): string {
	if (PLAIN_TITLES[title]) return PLAIN_TITLES[title];
	const [head, ...rest] = title.split(' · ');
	const plain = PLAIN_TITLES[head];
	return plain ? [plain, ...rest].join(' · ') : title;
}

// Funciones por valor de la barra de comandos, al estilo Bloomberg: «NVDA GP» abre la ficha de NVIDIA
// con el gráfico ampliado. La función va detrás del valor, separada por un espacio, y abre un panel de
// la ficha /s (src/routes/s/+page.svelte), que la lee de la URL: /s?sym=NVDA&fn=gp.

export interface StockFunction {
	/** Lo que se escribe detrás del valor: «GP». */
	code: string;
	/** Nombre corto, para la ayuda y las sugerencias. */
	name: string;
	/** Qué abre, en la ficha del valor. */
	desc: string;
}

export const FUNCTIONS: readonly StockFunction[] = [
	{ code: 'GP', name: 'Gráfico', desc: 'Gráfico del precio (TradingView)' },
	{ code: 'DES', name: 'Descripción', desc: 'Perfil de la empresa y cotización' },
	{ code: 'FA', name: 'Fundamentales', desc: 'Datos fundamentales: cuentas, márgenes y valoración' },
	{ code: 'TA', name: 'Análisis técnico', desc: 'Indicadores y medias móviles: comprar, vender o neutral' },
	{ code: 'CN', name: 'Noticias', desc: 'Titulares que nombran la empresa' },
	{ code: 'SEC', name: 'Documentos SEC', desc: 'Últimos documentos en la SEC (solo empresas de EE. UU.)' }
];

/** La función de un texto («gp», «GP»), o undefined si no es ninguna. */
export function findFunction(raw: string): StockFunction | undefined {
	const q = raw.trim().toUpperCase();
	return FUNCTIONS.find((f) => f.code === q);
}

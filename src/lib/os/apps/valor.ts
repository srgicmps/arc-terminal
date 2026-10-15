// App «Valor» de Arc OS: la ficha de un valor de la web (/s?sym=NVDA) en una ventana. No es un comando de la barra
// (se abre escribiendo el símbolo), así que no sale de COMMANDS: sin esta app, «NVDA» en el buscador, la Terminal,
// el Expediente o la Línea de tiempo no abría nada. Varias a la vez, para comparar valores lado a lado.
import type { ToolApp } from '../apps.ts';

/** El símbolo de la ruta («/s?sym=nvda» → «NVDA»); sin ?sym, la ficha enseña NVDA (src/routes/s). */
export const symOf = (path: string | undefined) => (new URLSearchParams(path?.split('?')[1]?.split('#')[0] ?? '').get('sym') ?? 'NVDA').toUpperCase();

const app: ToolApp = {
	id: 'valor',
	name: 'Valor',
	icon: '◆',
	desc: 'Ficha de un valor: gráfico, datos, análisis técnico, resultados y noticias',
	href: '/s',
	size: { w: 960, h: 680 },
	single: false,
	order: 15,
	title: (path) => `Valor · ${symOf(path)}`
};

export default app;

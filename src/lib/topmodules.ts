// Los paneles de la portada modular (TOP), con un id estable cada uno (es la clave de lo guardado). Aparte de
// la vista para que la bienvenida (src/lib/onboarding) pueda montar la portada de cada uno.
import type { ModuleDef } from './layout.ts';

export const TOP_MODULES: readonly ModuleDef[] = [
	{ id: 'rates', title: 'Tipos y bonos' },
	{ id: 'macro', title: 'Macro' },
	{ id: 'fx', title: 'Divisas y cripto' },
	{ id: 'important', title: 'Lo importante' },
	{ id: 'news', title: 'Titulares' },
	{ id: 'weather', title: 'Tiempo' },
	{ id: 'power', title: 'Luz' },
	{ id: 'fuel', title: 'Gasolina' },
	{ id: 'boe', title: 'BOE de hoy' },
	{ id: 'quakes', title: 'Terremotos' },
	{ id: 'predictions', title: 'Mercados de predicción' },
	{ id: 'hn', title: 'Hacker News' },
	// Solo en la portada modular (en la general ya están la cinta de cotizaciones y CAL).
	{ id: 'agenda', title: 'Hoy en la agenda' },
	{ id: 'markets', title: 'Mercados' },
	{ id: 'sessions', title: 'Sesiones de las bolsas' },
	{ id: 'risk', title: 'Termómetro de riesgo' },
	{ id: 'puzzle', title: 'Problema del día' },
	{ id: 'week', title: 'Tu semana' }
];

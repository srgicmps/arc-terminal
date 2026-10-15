import type { Command } from '../commands.ts';

export default {
	order: 262, code: 'MURO', route: '/x/muro', key: 'Muro para la tele', desc: 'Pantalla para una tele o un segundo monitor: hora, bolsas, titulares, cinta y avisos', sources: 'IMP, USGS, Finnhub', aliases: ['pared', 'tele', 'monitor', 'wall'],
	manual: {
		section: 'Sistema',
		what: 'Experiencia «Muro»: Arc Terminal para dejarlo puesto en una tele o un segundo monitor, sin tocar nada. Hora enorme, las bolsas del mundo (abiertas o cerradas y cuánto falta), el titular más importante que cambia cada 12 s, una cinta de cotizaciones y, si pasa algo gordo, un aviso a pantalla completa.',
		tips: ['Esc vuelve a la portada.', 'Los avisos usan los mismos umbrales que los urgentes al móvil (terremoto de 6,5 o más, o un tema que dan 6 medios en 3 secciones) y salen 15 s de cada minuto durante 3 h.', 'Si el navegador lo permite, la pantalla no se apaga sola.', 'El modo TV sigue igual: ese rota vistas; el muro es una pantalla propia.'],
		panels: [
			{ name: 'Relojes', what: 'Hora de Madrid y de seis bolsas, con su estado.' },
			{ name: 'Titular', what: 'Lo más importante ahora (IMP), de uno en uno.' },
			{ name: 'Cinta', what: 'Valores de EE. UU. con cotización de Finnhub.' }
		]
	}
} satisfies Command;

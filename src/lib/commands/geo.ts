import type { Command } from '../commands.ts';

export default {
	order: 40, code: 'GEO', route: '/geo', key: 'Geopolítica', desc: 'Geopolítica, terremotos y elecciones', sources: 'BBC, Al Jazeera, DW, France 24, The Guardian, USGS, Wikidata', pinned: true,
	manual: {
		section: 'Mundo',
		what: 'Geopolítica: titulares internacionales, un mapa con terremotos, ciclones, incendios y crisis, elecciones, sanciones y mercados de predicción.',
		tips: ['En el mapa puedes encender y apagar capas (terremotos, ciclones, incendios y volcanes, estrechos, sanciones, crisis); toca un punto para ver su ficha.'],
		panels: [
			{ name: 'Mapa', what: 'Lo que pasa ahora en el mundo, por capas.' },
			{ name: 'Titulares', what: 'Noticias internacionales.' },
			{ name: 'Mercados de predicción', what: 'Probabilidades de Polymarket.' },
			{ name: 'Rutas marítimas clave', what: 'Barcos al día por los estrechos y el cambio en un año.' },
			{ name: 'Crisis y desastres activos', what: 'Las crisis abiertas más recientes.' },
			{ name: 'Próximas elecciones', what: 'Los próximos 90 días; G20 y UE en ámbar.' },
			{ name: 'Sanciones y aranceles de EE. UU.', what: 'OFAC, USTR e ITA.' },
			{ name: 'Organismos internacionales', what: 'Comunicados de la ONU y la OMC.' },
			{ name: 'Gobiernos e instituciones', what: 'Comunicados oficiales.' },
			{ name: 'Terremotos en el mundo', what: 'M4,5 o más de los últimos 7 días (USGS).' },
			{ name: 'Terremotos en España', what: 'Los más fuertes de los últimos 10 días (IGN).' },
			{ name: 'Huracanes, incendios y volcanes', what: 'Los activos ahora.' }
		]
	}
} satisfies Command;

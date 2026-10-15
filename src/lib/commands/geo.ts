import type { Command } from '../commands.ts';

export default {
	order: 40, code: 'GEO', route: '/geo', key: 'Geopolítica', desc: 'Geopolítica, terremotos y elecciones', sources: 'BBC, Al Jazeera, DW, France 24, The Guardian, USGS, NOAA SWPC, Wikidata, EASA', pinned: true,
	manual: {
		section: 'Mundo',
		what: 'Geopolítica: titulares internacionales, un mapa con terremotos, ciclones, incendios, elecciones, sanciones y mercados de predicción.',
		tips: ['En el mapa puedes encender y apagar capas (terremotos, ciclones, incendios y volcanes, estrechos, sanciones); toca un punto para ver su ficha.', 'En «Titulares», el selector de región deja solo las noticias de Europa, América, Asia y Pacífico, Oriente Próximo o África.'],
		panels: [
			{ name: 'Mapa', what: 'Lo que pasa ahora en el mundo, por capas.' },
			{ name: 'Titulares', what: 'Noticias internacionales.' },
			{ name: 'Mercados de predicción', what: 'Probabilidades de Polymarket.' },
			{ name: 'Rutas marítimas clave', what: 'Barcos al día por los estrechos y el cambio en un año.' },
			{ name: 'Espacio aéreo en conflicto', what: 'Boletines CZIB activos de la EASA: zonas donde se pide a las aerolíneas no volar o volar alto. También es una capa del mapa.' },
			{ name: 'Próximas elecciones', what: 'Los próximos 90 días; G20 y UE en ámbar.' },
			{ name: 'Sanciones y aranceles de EE. UU.', what: 'OFAC, USTR e ITA.' },
			{ name: 'Organismos internacionales', what: 'Comunicados de la ONU y la OMC.' },
			{ name: 'Gobiernos e instituciones', what: 'Comunicados oficiales.' },
			{ name: 'Terremotos en el mundo', what: 'M4,5 o más de los últimos 7 días (USGS).' },
			{ name: 'Huracanes, incendios y volcanes', what: 'Los activos ahora.' },
			{ name: 'Gasto militar', what: 'Los 15 países que más gastan en defensa (SIPRI).' },
			{ name: 'Avisos de viaje de EE. UU.', what: 'Nivel de riesgo del Departamento de Estado, de 1 a 4.' }
		]
	}
} satisfies Command;

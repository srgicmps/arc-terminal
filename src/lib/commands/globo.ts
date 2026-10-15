import type { Command } from '../commands.ts';

export default {
	order: 41,
	code: 'GLOBO',
	route: '/globo',
	key: 'Globo 3D',
	desc: 'El mapa de GEO en un globo 3D que gira',
	sources: 'USGS, NOAA, NASA, GDACS, EASA, NGA, IODA, Departamento de Estado, titulares',
	aliases: ['globe', 'mundo 3d', '3d'],
	manual: {
		section: 'Mundo',
		what: 'Un globo terráqueo que gira con todo lo geolocalizado de la terminal: conflictos, terremotos, catástrofes, avisos de viaje, elecciones, cortes de internet, espacio aéreo, avisos a barcos, estrechos y sanciones.',
		tips: [
			'Arrastra para girarlo (sigue un poco por inercia); rueda o pellizco para acercar. Con el teclado: flechas y + o −.',
			'Toca un punto: el globo lo centra y abre su ficha. Si nadie lo toca, gira solo despacio (salvo con «reducir movimiento»).',
			'Las capas se encienden y apagan arriba. También está en el mapa de GEO («Ver en 3D») y en la Sala de control.'
		],
		panels: [{ name: 'Globo', what: 'Lo que pasa en el mundo, por capas, en 3D.' }]
	}
} satisfies Command;

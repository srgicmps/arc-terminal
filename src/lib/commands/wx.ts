import type { Command } from '../commands.ts';

export default {
	order: 140, code: 'WX', route: '/wx', key: 'Tiempo', desc: 'Tiempo, aire y sol en tu sitio y otras ciudades', sources: 'Open-Meteo', aliases: ['tiempo', 'clima', 'lugar', 'sitio'], arg: { param: 'buscar', label: 'Cambiar tu sitio', example: 'LUGAR Tokio' },
	manual: {
		section: 'Utilidades',
		what: 'El tiempo de tu sitio y de otras ciudades: previsión, mar, calidad del aire, UV y polen, sol y luna, y avisos.',
		args: [{ label: 'Cambiar tu sitio', examples: ['WX Tokio', 'LUGAR Nueva York'] }],
		tips: ['«LUGAR» y «sitio» también abren esta vista: «LUGAR Tokio» busca la ciudad y la deja como tu sitio.', 'Tu sitio se cambia también desde el chip de la cabecera, con «Usar mi ubicación» y hasta 5 favoritos.'],
		panels: [
			{ name: 'Una ficha por ciudad', what: 'Tiempo ahora y próximos días; la primera es tu sitio.' },
			{ name: 'Avisos · Menorca', what: 'Avisos meteorológicos de AEMET vía MeteoAlarm.' },
			{ name: 'Mar', what: 'Oleaje y agua (en Menorca, costa norte frente a sur).' },
			{ name: 'Sol y luna', what: 'Salida y puesta del sol y fase de la luna.' },
			{ name: 'Aire', what: 'Índice europeo de calidad del aire.' },
			{ name: 'UV y polen', what: 'Índice UV y los pólenes que se notan.' }
		]
	}
} satisfies Command;

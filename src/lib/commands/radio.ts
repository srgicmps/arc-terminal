import type { Command } from '../commands.ts';

export default {
	order: 261, code: 'RADIO', route: '/x/radio', key: 'Arc Radio', desc: 'Informativo hablado: lo de hoy leído en voz alta, a manos libres', sources: 'IMP, FRED, BCE, Eurostat, INE, calendarios de publicaciones, Finnhub', aliases: ['informativo', 'escuchar', 'podcast', 'briefing'],
	manual: {
		section: 'Sistema',
		what: 'Experiencia «Radio»: un informativo hablado con la voz del navegador. Un toque en «Empezar» y va leyendo bloque a bloque lo más importante, los mercados, la economía, lo que se publica hoy y tus valores, con lo que dice en grande y subtítulos.',
		tips: ['Pausa, bloque anterior o siguiente y cuatro velocidades (se recuerda la última).', 'Tocar un bloque del programa salta a él.', '«Tus valores» sale de tu lista de MIS.'],
		panels: [
			{ name: 'Bloque en curso', what: 'Lo que se está leyendo, en grande, y los controles.' },
			{ name: 'Programa', what: 'Todos los bloques de hoy; el actual, resaltado.' }
		]
	}
} satisfies Command;

import type { Command } from '../commands.ts';

export default {
	order: 234, code: 'TEST', route: '/test', key: 'Test', desc: 'Test de la semana: cinco preguntas con los titulares y datos de la semana, para jugar en familia', sources: 'IMP, FRED, BCE, CoinGecko, USGS', aliases: ['test', 'quiz', 'preguntas', 'juego'],
	manual: {
		section: 'Utilidades',
		what: 'Cinco preguntas hechas con lo que ha pasado esta semana: titulares, mercados y terremotos. Sin IA: salen de los datos con reglas fijas.',
		tips: [
			'Todos ven las mismas preguntas durante la semana (de lunes a domingo); el lunes salen otras.',
			'Tu puntuación se guarda en tu cuenta, así que la ves en todos tus dispositivos. Compara con la familia de viva voz.'
		],
		panels: [
			{ name: 'Preguntas', what: 'Toca una respuesta: se marca si has acertado y por qué.' },
			{ name: 'Tus semanas', what: 'Tu puntuación de las últimas semanas.' }
		]
	}
} satisfies Command;

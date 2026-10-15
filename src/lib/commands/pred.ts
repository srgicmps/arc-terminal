import type { Command } from '../commands.ts';

export default {
	order: 264, code: 'PRED', route: '/x/predicciones', key: 'Predicciones', desc: 'Juego: adivina el próximo IPC, paro o tipo del BCE antes de que salga', sources: 'INE, BLS, Eurostat, BCE, calendarios de publicaciones', aliases: ['predicciones', 'juego', 'apuestas', 'previsiones', 'quiniela'],
	manual: {
		section: 'Sistema',
		what: 'Experiencia «Predicciones»: antes de cada dato (IPC de España, de EE. UU. y de la zona euro, paro de España y de EE. UU., tipo de depósito del BCE) apuestas tu previsión. Cuando sale, se puntúa: 100 si lo clavas y menos cuanto más te alejas. Rachas y clasificación entre los usuarios de Arc.',
		tips: ['Se puede cambiar la apuesta hasta la hora de la publicación.', 'Las apuestas de los demás se ven al cerrar cada ronda.', 'Con cuenta (arcterminal.dev) juegas contra todos; sin ella, solo, en este navegador.', 'Racha: rondas seguidas con 50 puntos o más.'],
		panels: [
			{ name: 'Próximas rondas', what: 'Los datos que vienen, el último publicado y tu apuesta.' },
			{ name: 'Resultados', what: 'Lo que salió, tu apuesta y tus puntos, frente al consenso de Arc y a repetir el dato anterior.' },
			{ name: 'Clasificación', what: 'Puntos, rachas y clavadas de cada jugador, con su apodo.' }
		]
	}
} satisfies Command;

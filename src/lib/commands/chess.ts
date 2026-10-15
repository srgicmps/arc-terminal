import type { Command } from '../commands.ts';

export default {
	order: 230, code: 'CHESS', route: '/chess', key: 'Ajedrez', desc: 'Ajedrez contra Stockfish (5 niveles), análisis y problema del día', sources: 'Stockfish, chess.js, Lichess', aliases: ['ajedrez'],
	manual: {
		section: 'Utilidades',
		what: 'Ajedrez contra Stockfish en el navegador (5 niveles) o a dos en el mismo dispositivo, con pista, análisis de la partida y el problema del día.',
		tips: ['La partida se guarda en este navegador después de cada jugada.', 'El motor (unos 7 MB) se descarga la primera vez que juegas y luego funciona sin conexión.'],
		panels: [
			{ name: 'Partida', what: 'El tablero.' },
			{ name: 'Controles', what: 'Deshacer, pista, girar, nueva, analizar, abandonar, rival, color, reloj y copiar el PGN.' },
			{ name: 'Jugadas', what: 'La lista de jugadas; toca una para repasarla.' },
			{ name: 'Evaluación', what: 'Tras analizar, cómo va la partida jugada a jugada.' }
		]
	}
} satisfies Command;

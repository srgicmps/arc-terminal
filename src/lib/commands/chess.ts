import type { Command } from '../commands.ts';

export default { order: 230, code: 'CHESS', route: '/chess', key: 'Ajedrez', desc: 'Ajedrez contra Stockfish (5 niveles), análisis y problema del día', sources: 'Stockfish, chess.js, Lichess', aliases: ['ajedrez'] } satisfies Command;

import type { Command } from '../commands.ts';

export default { order: 60, code: 'WS', route: '/ws', key: 'Wall Street', desc: 'Wall Street: mapa de calor, curva de tipos, divisas y cripto', sources: 'TradingView, Tesoro de EE. UU., BCE, CoinGecko, CNBC, WSJ', pinned: true, aliases: ['bolsa', 'wall street'] } satisfies Command;

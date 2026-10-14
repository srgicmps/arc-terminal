import type { Command } from '../commands.ts';

export default { order: 175, code: 'CMP', route: '/cmp', key: 'Comparar', desc: 'Compara varios valores en un gráfico en base 100', sources: 'TradingView', aliases: ['comparar', 'comparativa'], arg: { param: 's', label: 'Valores separados por espacios', example: 'CMP NVDA AMD AVGO' } } satisfies Command;

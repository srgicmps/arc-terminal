import type { Command } from '../commands.ts';

export default { order: 180, code: 'FONDOS', route: '/fondos', key: 'Fondos', desc: 'Carteras de Berkshire, Pershing Square, Third Point, Bridgewater, ARK y Renaissance: mayores posiciones, compras y ventas', sources: 'SEC EDGAR (13F)', aliases: ['13f', 'carteras', 'buffett'] } satisfies Command;

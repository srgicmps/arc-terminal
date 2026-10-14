import type { Command } from '../commands.ts';

export default { order: 200, code: 'PAIS', route: '/pais', key: 'País', desc: 'Ficha de un país: PIB, IPC, paro, deuda, tipos, bono, moneda, previsiones del FMI y titulares', sources: 'Eurostat, BLS, FRED, BCE, BIS, Tesoro de EE. UU., FMI, todos los medios', aliases: ['país', 'country'], arg: { param: 'c', label: 'País (nombre o código)', example: 'PAIS Alemania' } } satisfies Command;

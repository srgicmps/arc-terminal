import type { Command } from '../commands.ts';

export default { order: 140, code: 'WX', route: '/wx', key: 'Tiempo', desc: 'Tiempo, aire y sol en tu sitio y otras ciudades', sources: 'Open-Meteo', aliases: ['tiempo', 'clima', 'lugar', 'sitio'], arg: { param: 'buscar', label: 'Cambiar tu sitio', example: 'LUGAR Tokio' } } satisfies Command;

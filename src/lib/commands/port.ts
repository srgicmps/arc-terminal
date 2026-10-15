import type { Command } from '../commands.ts';

export default {
	order: 150, code: 'PORT', route: '/port', key: 'Puertos', desc: 'Barcos en puertos y estrechos (Gibraltar, Róterdam, Singapur, Maó…) con AIS en directo', sources: 'aisstream.io', aliases: ['barcos', 'puertos', 'ais'],
	manual: {
		section: 'Mundo',
		what: 'Barcos en puertos y estrechos (Gibraltar, Róterdam, Singapur, Maó…) según los mensajes AIS que emiten ahora mismo.',
		panels: [{ name: 'Barcos', what: 'Barcos detectados en cada puerto o estrecho durante la escucha.' }]
	}
} satisfies Command;

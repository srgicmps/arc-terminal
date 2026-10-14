import type { Command } from '../commands.ts';

export default {
	order: 210, code: 'WIKI', route: '/wiki', key: 'Wikipedia', desc: 'Lo más leído en Wikipedia y efemérides del día', sources: 'Wikipedia en español',
	manual: {
		section: 'Utilidades',
		what: 'Wikipedia hoy: lo más leído ayer, el artículo destacado y efemérides, en español o en inglés.',
		panels: [
			{ name: 'Lo más leído', what: 'Artículos más vistos ayer.' },
			{ name: 'In the news', what: 'La portada de la Wikipedia en inglés (solo en inglés).' },
			{ name: 'Artículo destacado', what: 'El del día.' },
			{ name: 'Tal día como hoy', what: 'Efemérides.' }
		]
	}
} satisfies Command;

import type { Command } from '../commands.ts';

export default {
	order: 195, code: 'RSS', route: '/rss', key: 'Mis RSS', desc: 'Tus feeds RSS, como Feedly: los titulares de tus blogs y medios', sources: 'Tus feeds', aliases: ['feeds', 'feedly', 'mis rss'],
	manual: {
		section: 'Sistema',
		what: 'Añade los feeds (RSS o Atom) de tus blogs y medios y lee sus titulares juntos, de más nuevo a más viejo. La lista se guarda en tu cuenta. Solo en arcterminal.dev.',
		tips: ['Hasta 20 feeds. Se leen como mucho cada 15 minutos.', 'Si un feed no responde, sale marcado en rojo; los demás siguen.'],
		panels: [
			{ name: 'Titulares', what: 'Los últimos titulares de todos tus feeds.' },
			{ name: 'Tus feeds', what: 'Añadir y quitar feeds.' }
		]
	}
} satisfies Command;

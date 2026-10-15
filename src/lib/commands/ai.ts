import type { Command } from '../commands.ts';

export default {
	order: 80, code: 'AI', route: '/ai', key: 'IA', desc: 'Inteligencia artificial', sources: 'MIT Technology Review, Hugging Face, OpenAI, Google, The Verge', pinned: true,
	manual: {
		section: 'Tecnología',
		what: 'Inteligencia artificial: titulares, lo que se habla en Hacker News, modelos en tendencia y papers del día.',
		panels: [
			{ name: 'Titulares', what: 'Noticias de IA.' },
			{ name: 'Tecnológicas en bolsa', what: 'Cotización en directo; toca un código para abrir su ficha.' },
			{ name: 'IA en Hacker News', what: 'Lo de IA que está en la portada.' },
			{ name: 'Modelos en tendencia · Hugging Face', what: 'Los modelos más populares de la semana.' },
			{ name: 'Papers del día · Hugging Face', what: 'Artículos de investigación destacados.' }
		]
	}
} satisfies Command;

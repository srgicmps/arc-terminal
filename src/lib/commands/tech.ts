import type { Command } from '../commands.ts';

export default {
	order: 70, code: 'TECH', route: '/tech', key: 'Tecnología', desc: 'Tecnología y Hacker News', sources: 'Hacker News, TechCrunch, The Verge, Ars Technica, Xataka, Wired, CISA', pinned: true,
	manual: {
		section: 'Tecnología',
		what: 'Tecnología: titulares, Hacker News, las tecnológicas en bolsa, versiones nuevas de software y vulnerabilidades explotadas.',
		panels: [
			{ name: 'Titulares', what: 'Noticias de tecnología.' },
			{ name: 'Tecnológicas en bolsa', what: 'Cotización en directo; toca un código para abrir su ficha.' },
			{ name: 'Hacker News', what: 'Portada, ordenada por puntos.' },
			{ name: 'Vulnerabilidades explotadas (CISA)', what: 'Fallos de seguridad que ya se están aprovechando.' },
			{ name: 'Versiones', what: 'Última versión estable de programas clave; en ámbar, las de los últimos 7 días.' }
		]
	}
} satisfies Command;

import type { Command } from '../commands.ts';

export default {
	order: 197, code: 'PREGUNTA', route: '/pregunta', key: 'Pregunta (IA)', desc: 'Pregunta a Arc, con IA, sobre los datos de hoy', sources: 'Workers AI (Cloudflare) con los datos de hoy', aliases: ['pregunta a arc', 'preguntar'],
	arg: { param: 'q', label: 'Tu pregunta', example: 'PREGUNTA euríbor hoy' },
	manual: {
		section: 'Utilidades',
		what: 'Lo único de Arc con IA, aparte y opcional: Workers AI contesta solo con los datos de hoy. Si cita una cifra que no está en ellos, sale «No lo sé con los datos de hoy». Con cuenta, en arcterminal.dev.',
		args: [{ label: 'Tu pregunta', examples: ['PREGUNTA euríbor hoy'] }],
		tips: ['20 al día. No se guardan ni la pregunta ni la respuesta.', 'El resto de Arc sigue sin IA.'],
		panels: [
			{ name: 'Tu pregunta', what: 'Preguntar, con ejemplos.' },
			{ name: 'Respuesta', what: 'Marcada como IA, con sus fuentes y su hora.' }
		]
	}
} satisfies Command;

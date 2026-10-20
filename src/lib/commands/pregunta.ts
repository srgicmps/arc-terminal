import type { Command } from '../commands.ts';

export default {
	order: 197, code: 'PREGUNTA', route: '/pregunta', key: 'Pregunta (IA)', desc: 'Pregunta a Arc, con IA (Workers AI), sobre los datos de hoy; etiquetada y con las cifras comprobadas', sources: 'Workers AI (Cloudflare) sobre los datos de hoy de la terminal', aliases: ['pregunta a arc', 'preguntar'],
	arg: { param: 'q', label: 'Tu pregunta', example: 'PREGUNTA euríbor hoy' },
	manual: {
		section: 'Utilidades',
		what: 'La única parte de Arc con IA, aparte y opcional: escribes una pregunta y Workers AI (Cloudflare) la contesta solo con los datos de hoy de la terminal (de 1 a 4 fuentes, elegidas por palabras clave). Si la respuesta trae una cifra que no está en esos datos, se descarta y sale «No lo sé con los datos de hoy». Solo en arcterminal.dev, con cuenta.',
		args: [{ label: 'Tu pregunta', examples: ['PREGUNTA euríbor hoy', 'PREGUNTA precio del diésel en Madrid'] }],
		tips: [
			'Hasta 20 preguntas al día por persona. No se guardan ni la pregunta ni la respuesta: solo cuántas llevas.',
			'Puede equivocarse al explicar aunque las cifras cuadren: mira siempre las fuentes y su hora.',
			'Lo demás de Arc (la barra y sus preguntas sencillas, IMP, QUIEN, TEST, los avisos) sigue sin IA.'
		],
		panels: [
			{ name: 'Tu pregunta', what: 'El campo para preguntar, con ejemplos y cuántas te quedan hoy.' },
			{ name: 'Respuesta', what: 'La respuesta, marcada como generada con IA, con las fuentes y su hora.' }
		]
	}
} satisfies Command;

import type { Command } from '../commands.ts';

export default {
	order: 260, code: 'DOC', route: '/doc', key: 'Cómo funciona', desc: 'Cómo está hecho Arc Terminal: arquitectura, datos, fuentes y Svelte frente a Vue', sources: 'El propio código',
	manual: {
		section: 'Sistema',
		what: 'Cómo está hecho Arc Terminal: arquitectura, el viaje de los datos de la fuente a la pantalla, las fuentes y Svelte frente a Vue.',
		panels: [
			{ name: '1 · Arquitectura', what: 'Cloudflare Pages con Access delante y GitHub Actions como servidor.' },
			{ name: '2 · Cómo viajan los datos', what: 'Ejemplo: FUEL, de la API al panel.' },
			{ name: '3 · Fuentes', what: 'Todas las fuentes y cada cuánto se actualizan.' },
			{ name: '4 · Svelte 5 frente a Vue 3', what: 'Las mismas ideas en los dos.' },
			{ name: '5 · Cuidar los datos', what: 'Cómo se evita publicar datos rotos.' }
		]
	}
} satisfies Command;

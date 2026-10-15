import type { Command } from '../commands.ts';

export default {
	order: 240, code: 'TV', route: '/tv', key: 'Modo TV', desc: 'Modo TV: las vistas van rotando solas, a pantalla completa', sources: 'Arc Terminal', aliases: ['tele', 'televisión'], arg: { param: 'tv', label: 'Vistas que rotan', example: 'TV TOP,WS,GEO' },
	manual: {
		section: 'Sistema',
		what: 'Modo TV: elige vistas y cada cuánto cambian, y la terminal las va rotando sola, encajadas y a pantalla completa.',
		args: [{ label: 'Vistas que rotan', examples: ['TV TOP,WS,GEO', 'TV LUZ,WX'] }],
		tips: ['Espacio o un toque pausa; Esc sale.', 'También se arranca con una URL: /?tv=TOP,WS,GEO&s=30.'],
		panels: [
			{ name: 'Vistas', what: 'Las que rotan, en orden.' },
			{ name: 'Empezar', what: 'Cada cuánto cambia y el botón para arrancar.' }
		]
	}
} satisfies Command;

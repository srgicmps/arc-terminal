import type { Command } from '../commands.ts';

export default {
	order: 180, code: 'FONDOS', route: '/fondos', key: 'Fondos', desc: 'Carteras de Berkshire, Pershing Square, Third Point, Bridgewater, ARK y Renaissance: mayores posiciones, compras y ventas', sources: 'SEC EDGAR (13F)', aliases: ['13f', 'carteras', 'buffett'],
	manual: {
		section: 'Economía y mercados',
		what: 'Carteras de grandes fondos (Berkshire, Pershing Square, Bridgewater, ARK…) según su último 13F: mayores posiciones y lo más comprado y vendido.',
		tips: ['Necesita la clave SEC_USER_AGENT en la terminal; sin ella la vista avisa y no se rompe nada.'],
		panels: [{ name: 'Un panel por fondo', what: 'Sus 10 mayores posiciones y los cambios frente al trimestre anterior.' }]
	}
} satisfies Command;

import type { Command } from '../commands.ts';

export default {
	order: 185, code: 'HDS', route: '/hds', key: 'Accionistas', desc: 'Qué fondos de FONDOS tienen un valor, según su último 13F', sources: 'SEC EDGAR (13F)', aliases: ['accionistas', 'quién tiene', 'holders'], arg: { param: 's', label: 'Valor (código o nombre)', example: 'HDS NVDA' },
	manual: {
		section: 'Economía y mercados',
		what: 'Las carteras de FONDOS al revés: en lugar de qué tiene Berkshire, qué fondos tienen NVIDIA, con su puesto, su peso y si compraron o vendieron en el trimestre.',
		args: [{ label: 'Valor (código o nombre)', examples: ['HDS NVDA', 'HDS Kraft'] }],
		tips: [
			'Solo los fondos que sigue FONDOS y sus 100 mayores posiciones.',
			'El 13F llega hasta 45 días después del trimestre: no es la cartera de hoy.',
			'La ficha de cada valor de EE. UU. tiene también el panel «Fondos que la tienen».'
		],
		panels: [
			{ name: 'Quién lo tiene', what: 'Cada fondo que tiene el valor: puesto en su cartera, peso, valor y cambio frente al trimestre anterior.' },
			{ name: 'Los más repartidos', what: 'Los valores que están en más fondos a la vez.' }
		]
	}
} satisfies Command;

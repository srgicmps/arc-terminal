import type { Command } from '../commands.ts';

export default {
	order: 68, code: 'SEAS', route: '/seas', key: 'Estacional', desc: 'Estacionalidad: cuánto suele moverse una serie en cada mes del año', sources: 'Todas las series de la terminal', aliases: ['estacionalidad', 'estacional'], arg: { param: 's', label: 'Serie (atajo, id o nombre)', example: 'SEAS WTI' },
	bloomberg: [{ code: 'SEAG' }],
	manual: {
		section: 'Economía y mercados',
		what: 'Para una serie de la terminal (bono, tipo, petróleo, paro…), el cambio medio de cada mes del año y cuántos años subió, con la tabla año a año.',
		args: [{ label: 'Una serie, como en G', examples: ['SEAS WTI', 'SEAS US10', 'SEAS euríbor 12'] }],
		tips: [
			'Tipos y porcentajes se miden en diferencia (pb o pp); precios e índices, en variación %. Se usa el último dato de cada mes.',
			'Solo cuenta el historial que guarda la terminal: con pocos años, la media dice poco, y se avisa.'
		],
		panels: [
			{ name: 'Por meses', what: 'Cambio medio y mediano de cada mes y años al alza.' },
			{ name: 'Año a año', what: 'El cambio de cada mes en cada año, en verde o rojo.' }
		]
	}
} satisfies Command;

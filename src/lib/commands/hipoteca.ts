import type { Command } from '../commands.ts';

export default {
	order: 172, code: 'HIPOTECA', route: '/hipoteca', key: 'Hipoteca', desc: 'Tu hipoteca: cuota, cuadro de amortización y próxima revisión con el euríbor', sources: 'BCE (euríbor a 12 meses)', aliases: ['cuota', 'amortizacion', 'prestamo'],
	manual: {
		section: 'Tu dinero',
		what: 'Escribe lo que te queda de hipoteca y te dice la cuota, cuánto pagas de intereses cada año y cuánto cambiará la cuota en tu próxima revisión con el euríbor de hoy.',
		tips: [
			'Tus datos se guardan solo en tu navegador y, con cuenta, en tus ajustes privados: no los ve nadie más.',
			'Son los mismos que «Tu hipoteca» de ECO: cambiarlos en un sitio los cambia en el otro.',
			'La revisión es una estimación: el banco usa el euríbor de uno o dos meses antes.'
		],
		panels: [
			{ name: 'Tus datos', what: 'Capital pendiente, años, tipo de ahora, diferencial y cuándo se revisa (anual o semestral).' },
			{ name: 'Tu próxima revisión', what: 'Cuota de hoy, la que tendrías tras la revisión con el euríbor a 12 meses actual y la diferencia.', keys: ['revision'] },
			{ name: 'Cuadro de amortización', what: 'Por años: lo que pagas, cuánto es interés, cuánto capital y lo que queda.', keys: ['cuadro'] }
		]
	}
} satisfies Command;

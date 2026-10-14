import type { Command } from '../commands.ts';

export default {
	order: 130, code: 'AGUA', route: '/agua', key: 'Agua', desc: 'Reservas de agua: embalses de España y sequía en Europa', sources: 'MITECO, Copernicus (European Drought Observatory)', aliases: ['embalses', 'sequía', 'sequia'],
	manual: {
		section: 'España',
		what: 'Reservas de agua: cuánto tienen los embalses de España, por cuencas, y el mapa de sequía de Europa.',
		panels: [
			{ name: 'Embalses de España', what: 'Reserva de la semana, frente a hace un año y a la media de 10 años.' },
			{ name: 'Por cuencas', what: 'De menos a más llena.' },
			{ name: 'Sequía en Europa', what: 'Indicador combinado de Copernicus, cada 10 días.' }
		]
	}
} satisfies Command;

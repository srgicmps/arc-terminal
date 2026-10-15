import type { Command } from '../commands.ts';

export default {
	order: 170, code: 'FUEL', route: '/fuel', key: 'Gasolina', desc: 'Gasolineras más baratas de Menorca', sources: 'Ministerio para la Transición Ecológica', pinned: true, aliases: ['gasolina', 'diésel', 'carburante'], arg: { param: 'zona', label: 'Provincia (nombre o número)', example: 'FUEL Madrid' },
	manual: {
		section: 'Utilidades',
		what: 'Las gasolineras más baratas de Menorca o de cualquier provincia, con el ahorro frente a la media y cómo está el precio frente a España y Europa.',
		args: [{ label: 'Provincia (nombre o número)', examples: ['FUEL Madrid', 'FUEL 28', 'gasolina Menorca'], options: ['Menorca', 'cualquier provincia por nombre o por su número'] }],
		tips: ['«Cerca de mí» usa tu ubicación para abrir la provincia más cercana.', 'El combustible y la zona van en la URL: un favorito abre lo mismo.', 'La ☆ de una estación la hace «Mi gasolinera»: sale arriba con su precio, su puesto y lo que ahorras, y va guardando su historial.'],
		panels: [
			{ name: 'Mi gasolinera', what: 'Tu favorita: precio de hoy, cambio desde el último día, ahorro frente a la media en 50 L, puesto en su zona e historial.' },
			{ name: 'Combustible · zona', what: 'Gasolineras de más barata a más cara, con filtro por municipio y lo que ahorras en un depósito de 50 L.' },
			{ name: 'Zona frente a España', what: 'Precio medio diario de la zona y de España.' },
			{ name: 'España frente a Europa', what: 'Con y sin impuestos (Weekly Oil Bulletin).' },
			{ name: 'Precio medio por provincia', what: 'De más barata a más cara.' }
		]
	}
} satisfies Command;

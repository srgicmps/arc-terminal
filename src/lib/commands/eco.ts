import type { Command } from '../commands.ts';

export default {
	order: 30, code: 'ECO', route: '/eco', key: 'Economía', desc: 'Economía y macro: paro, inflación, PIB, tipos', sources: 'Eurostat, BCE, BLS, Tesoro de EE. UU., El País, Expansión, FT', pinned: true,
	manual: {
		section: 'Economía y mercados',
		what: 'Economía y macro: paro, inflación, PIB, deuda, tipos de los bancos centrales, bonos y vivienda, con los titulares de economía.',
		tips: ['Los paneles de la Fed y FRED solo salen si la terminal tiene su clave (FRED_API_KEY): sin ella no se rompe nada.'],
		panels: [
			{ name: 'Paro', what: 'Tasa de paro de la zona euro y sus países.' },
			{ name: 'Inflación', what: 'IPCA, variación anual.' },
			{ name: 'Inflación del G20', what: 'IPC de las grandes economías.' },
			{ name: 'PIB', what: 'Variación trimestral.' },
			{ name: 'PIB interanual', what: 'Frente al mismo trimestre del año anterior.' },
			{ name: 'Paro juvenil', what: 'Menores de 25 años.' },
			{ name: 'Deuda pública', what: 'En % del PIB.' },
			{ name: 'Precios de los alimentos', what: 'Índice de la FAO.' },
			{ name: 'Próximas reuniones', what: 'Fechas de decisión de tipos, en hora de España.' },
			{ name: 'BCE', what: 'Tipos oficiales y euríbor.' },
			{ name: 'Vivienda en el mundo', what: 'Precio de la vivienda, variación interanual.' },
			{ name: 'Tu hipoteca', what: 'Calculadora de hipoteca variable con el euríbor a 12 meses; recuerda lo que escribes.' },
			{ name: 'Previsiones del FMI', what: 'PIB real e inflación previstos.' },
			{ name: 'Discursos de banqueros centrales', what: 'Los más recientes.' },
			{ name: 'Bancos centrales', what: 'Tipo oficial de cada banco y su último cambio.' },
			{ name: 'Balances de los bancos centrales', what: 'Total del activo, semanal.' },
			{ name: 'Bonos a 10 años', what: 'Rentabilidad media mensual.' },
			{ name: 'Primas de riesgo', what: 'Frente al bono alemán, en puntos básicos.' },
			{ name: 'EE. UU.', what: 'Datos del BLS y del Tesoro.' },
			{ name: 'Fed y mercados', what: 'Series de FRED (con clave).' },
			{ name: 'Señales de recesión', what: 'Regla de Sahm, probabilidad de recesión y curva 10 años − 3 meses, con «activada» o «no» (FRED, con clave).' },
			{ name: 'Inflación esperada y tipos reales', what: 'Lo que descuenta el mercado de bonos de EE. UU.' },
			{ name: 'Gas almacenado', what: 'Llenado de los almacenes de gas de Europa.' },
			{ name: 'Lo que descuenta el mercado', what: 'Apuestas de Polymarket sobre economía.' },
			{ name: 'Titulares', what: 'Noticias de economía.' }
		]
	}
} satisfies Command;

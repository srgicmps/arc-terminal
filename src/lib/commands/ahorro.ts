import type { Command } from '../commands.ts';

export default {
	order: 174, code: 'AHORRO', route: '/ahorro', key: 'Ahorro', desc: 'Tu ahorro: dónde rinde el dinero, interés compuesto, lo que vale hoy y tu inflación', sources: 'BCE (depósitos, €STR, curva AAA), Banco de España (letras y bonos), Eurostat (IPCA del INE)', aliases: ['mi ipc', 'miipc', 'depositos', 'interes compuesto', 'inflacion personal'],
	manual: {
		section: 'Tu dinero',
		what: 'Para decidir qué hacer con tus ahorros: qué pagan hoy cuentas, depósitos y deuda, cuánto crece el dinero con los años, cuánto vale hoy el de otro año y cuál es tu inflación según en qué gastas.',
		tips: [
			'«Real» es lo que rinde menos la inflación: si es negativo, tu dinero compra menos cada año.',
			'Los depósitos son la media de lo que pagan los bancos en España (BCE), no la mejor oferta.',
			'Lo que escribes (cantidades y pesos de tu cesta) se guarda solo en tu navegador y, con cuenta, en tus ajustes privados.'
		],
		panels: [
			{ name: 'Dónde rinde hoy tu dinero', what: 'Cuentas y depósitos a plazo (media de España), €STR, depósito en el BCE, letras del Tesoro a 12 meses, deuda AAA a 1 año y bono español a 10 años, con su rentabilidad real.', keys: ['rinde', 'depositos'] },
			{ name: 'Interés compuesto', what: 'Cuánto tendrás si pones una cantidad hoy y otra cada mes a una rentabilidad, y cuánto sería en dinero de hoy.', keys: ['compuesto'] },
			{ name: 'Lo que vale hoy tu dinero de otro año', what: '«1.000 € de 2005, hoy»: con el IPCA de España desde 2002.', keys: ['valor'] },
			{ name: 'Tu inflación (MI IPC)', what: 'La inflación de cada grupo de gasto y la tuya con los pesos que pongas, frente a la general.', keys: ['ipc', 'cesta'] }
		]
	}
} satisfies Command;

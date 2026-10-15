import type { Command } from '../commands.ts';

export default {
	order: 263, code: 'BITACORA', route: '/x/bitacora', key: 'Tu bitácora', desc: 'Tu diario: notas, ideas con precio de entrada que se siguen solas y recordatorios', sources: 'Finnhub, todas las series de G', aliases: ['bitácora', 'diario', 'notas', 'journal'],
	manual: {
		section: 'Sistema',
		what: 'Experiencia «Bitácora»: un diario privado. Anotas notas sobre un valor, un país o un tema, ideas de inversión con su precio de entrada (se siguen solas: «desde que la anotaste, +4 %») y recordatorios para un día. Solo lo ves tú; con cuenta, en todos tus dispositivos.',
		tips: ['El precio de ahora sale de los valores de EE. UU. con cotización de Finnhub o de las series de G por su atajo (US10, BTC, WTI…). Si la serie ya es un %, la idea se mide en puntos.', 'Tocar un tema del diario lo filtra.', 'Hasta 200 entradas: si te pasas, se va la más antigua que no sea una idea abierta.'],
		panels: [
			{ name: 'Escribir', what: 'Nota, idea (con precio y si apuestas a que suba o baje) o recordatorio (con su día).' },
			{ name: 'Para hoy', what: 'Los recordatorios de hoy o atrasados; ✓ los da por hechos.' },
			{ name: 'Tus ideas', what: 'Las ideas abiertas, su precio de entrada, el de ahora y cómo van.' },
			{ name: 'Diario', what: 'Todo lo anotado, con buscador, filtro por tipo y temas.' }
		]
	}
} satisfies Command;

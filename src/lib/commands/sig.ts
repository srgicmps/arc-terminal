import type { Command } from '../commands.ts';

export default {
	order: 178, code: 'SIG', route: '/sig', key: 'Señales', desc: 'Señales técnicas: máximos y mínimos de 52 semanas, medias y RSI', sources: 'Finnhub, TradingView', aliases: ['señales', 'senales', 'técnico', 'tecnico', '52 semanas', 'rsi'], arg: { param: 's', label: 'Valor (código)', example: 'SIG NVDA' },
	manual: {
		section: 'Economía y mercados',
		what: 'Qué grandes valores de EE. UU. han marcado un máximo o un mínimo de 52 semanas en los últimos 10 días y, de un valor, el resumen de sus medias móviles y osciladores (RSI, MACD…).',
		args: [{ label: 'Valor (código)', examples: ['SIG NVDA', 'SIG KO'] }],
		tips: ['Los máximos y mínimos salen de Finnhub una vez cada 12 horas; las medias y el RSI, de TradingView en directo.'],
		panels: [
			{ name: 'Máximos de 52 semanas', what: 'Los que han tocado su máximo del año en los últimos 10 días.', keys: ['maximos', 'máximos'] },
			{ name: 'Mínimos de 52 semanas', what: 'Los que han tocado su mínimo del año en los últimos 10 días.', keys: ['minimos', 'mínimos'] },
			{ name: 'Medias y RSI', what: 'Resumen técnico de TradingView del valor elegido.', keys: ['rsi', 'medias'] }
		]
	}
} satisfies Command;

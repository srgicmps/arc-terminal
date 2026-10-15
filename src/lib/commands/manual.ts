import type { Command } from '../commands.ts';

export default {
	order: 280, code: 'MANUAL', route: '/manual', key: 'Manual', desc: 'Manual completo: vistas, paneles, comandos, atajos y ajustes', sources: '—', aliases: ['manual', 'guía', 'ayuda completa'],
	manual: {
		section: 'Sistema',
		what: 'Este manual: todas las vistas con sus paneles, los comandos con ejemplos, los atajos, lo que se guarda en tu navegador, los avisos al móvil y preguntas frecuentes.',
		tips: ['El buscador filtra todo el manual, sin tildes ni mayúsculas.', 'Los ejemplos se pueden tocar: abren la vista igual que si los escribieras en la barra.']
	}
} satisfies Command;

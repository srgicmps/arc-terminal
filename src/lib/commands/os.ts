import type { Command } from '../commands.ts';

export default {
	order: 247, code: 'OS', route: '/os', key: 'Arc OS', desc: 'Arc OS: escritorio con ventanas, varias vistas a la vez', sources: 'Arc Terminal', aliases: ['ventanas', 'escritorio', 'arc os', 'windows', 'linux'],
	manual: {
		section: 'Sistema',
		what: 'Arc como un sistema operativo: cada vista y cada experiencia se abre en una ventana que se mueve, se redimensiona, se encaja a una mitad o un cuarto y se minimiza. Varios escritorios con nombre, guardados en tu cuenta.',
		tips: [
			'Arrastra una ventana contra un borde para encajarla a una mitad; contra una esquina, a un cuarto; arriba, a pantalla entera.',
			'Atajos: Alt+º siguiente ventana, Alt+↑ maximizar, Alt+↓ minimizar, Alt+⇧+← / → media pantalla, Alt+W cerrar, Alt+1…6 escritorio.',
			'«Modo clásico», en la barra de abajo, vuelve a la web de siempre.'
		],
		panels: [{ name: 'Escritorio', what: 'Las ventanas abiertas y la barra de tareas con las apps, los escritorios y una tecla por ventana.' }]
	}
} satisfies Command;

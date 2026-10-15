// Lo que la shell de Arc OS necesita del núcleo (gestor de ventanas y escritorios), en su forma mínima. El
// adaptador (Shell.svelte) lo saca del núcleo; así la shell se prueba y se mantiene sin depender de sus detalles.

export interface TaskWin {
	id: string;
	appId: string;
	title: string;
	icon?: string;
	minimized: boolean;
	focused: boolean;
}

export interface DeskInfo {
	id: string;
	name: string;
	active: boolean;
}

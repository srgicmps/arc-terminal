// Estado de orden de una tabla (cabeceras SortTh): qué columna y en qué sentido, como un ref() de Vue.
// Pulsar la misma columna le da la vuelta; una nueva empieza de mayor a menor (o como se diga en `first`).
import type { SortDir } from './sort.ts';

export class Sorter<K extends string> {
	key = $state<K | null>(null);
	dir = $state<SortDir>('desc');

	toggle(next: K, first: SortDir = 'desc') {
		if (this.key === next) this.dir = this.dir === 'desc' ? 'asc' : 'desc';
		else {
			this.key = next;
			this.dir = first;
		}
	}
}

// Enlaces a las vistas de los comandos cuando la ruta viene de una variable (c.route, targetPath()).
import { resolve } from '$app/paths';
import type { Command } from './commands.ts';

/**
 * resolve() de SvelteKit con una ruta de COMMANDS. resolve() comprueba la ruta contra una unión de todas
 * las rutas de la web, y TypeScript deja de repartir esa comprobación cuando la unión pasa de 25 miembros:
 * con el comando 26 dejaba de compilar. Aquí se llama con la ruta como texto (todas las de COMMANDS son
 * rutas sin parámetros, así que el resultado es el mismo), y añadir un comando no vuelve a romperlo.
 */
export function routeHref(route: Command['route'] | '/s'): string {
	return (resolve as (route: string) => string)(route);
}

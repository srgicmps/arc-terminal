// Entrada del Worker «arc-terminal-cron» (cloud/cron/wrangler.toml). Solo el manejador del cron: Cloudflare no
// arranca un Worker cuyo módulo principal exporte otras cosas (constantes, funciones sueltas). Lo que hace cada
// cron está en despertador.ts, con sus tests.
import { despertar, type Entorno } from './despertador.ts';

/** Lo mínimo del ScheduledController de Cloudflare que se usa aquí. */
interface Controlador {
	cron: string;
}

export default {
	async scheduled(controller: Controlador, env: Entorno): Promise<void> {
		await despertar(controller.cron, env);
	}
};

// /code.json: qué publicación hay ahora mismo (unos 70 bytes). La pregunta cada minuto src/lib/fresh.svelte.ts
// para saber si han cambiado solo los datos (la vista se refresca en su sitio) o también el código («Recargar»).
// Se genera al construir (prerender), como agenda.ics. El service worker no lo guarda: va siempre a la red.
import { version } from '$app/env';

export const prerender = true;

export function GET() {
	// version: la de SvelteKit, cambia en cada build. __ARC_CODE__: el commit (vite.config.ts), igual en las
	// pasadas de datos y distinto cuando cambia el código.
	return Response.json({ v: version, code: __ARC_CODE__ });
}

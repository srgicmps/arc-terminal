// MANUAL: qué miniaturas de las vistas hay en static/manual/ (las captura scripts/thumbs.ts en la Action).
// Es +page.server.ts: se mira al construir la web, y el navegador solo recibe la lista de nombres. Si una
// miniatura falta (o la carpeta no existe), su ficha sale sin imagen y no se pide nada que dé 404.
import { readdirSync } from 'node:fs';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	let thumbs: string[] = [];
	try {
		thumbs = readdirSync('static/manual')
			.filter((f) => f.endsWith('.jpg'))
			.map((f) => f.slice(0, -'.jpg'.length));
	} catch {
		// Sin carpeta: ninguna miniatura.
	}
	return { thumbs };
};

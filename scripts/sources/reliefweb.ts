// Crisis y desastres activos según ReliefWeb (https://reliefweb.int), el servicio de información de la
// OCHA (ONU). API pública y sin clave; solo pide un «appname» que identifique a quien llama y limita
// las peticiones por él (1000 al día). Términos: hay que citar a ReliefWeb y la fuente original.
import type { Disaster } from '../../src/lib/types.ts';
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

const FIELDS = ['name', 'date.event', 'date.created', 'primary_country.name', 'primary_type.name', 'glide', 'url_alias', 'url'];

export const RELIEFWEB_URL =
	'https://api.reliefweb.int/v2/disasters?appname=arc-terminal&filter[field]=status&filter[value]=ongoing' +
	'&sort[]=date.event:desc&limit=60' +
	FIELDS.map((f) => `&fields[include][]=${f}`).join('');

/** Convierte la respuesta de /v2/disasters en nuestra lista, de más reciente a más antiguo. */
export function parseDisasters(body: Raw): Disaster[] {
	return list<Raw>(body?.data)
		.map((entry): Disaster | null => {
			const f = entry?.fields ?? {};
			const name = plain(f.name, 200);
			if (!entry?.id || !name) return null;
			const raw = f.date?.event ?? f.date?.created;
			const t = Date.parse(raw ?? '');
			return {
				id: String(entry.id),
				name,
				country: plain(f.primary_country?.name ?? list<Raw>(f.country)[0]?.name, 80),
				type: plain(f.primary_type?.name ?? list<Raw>(f.type)[0]?.name, 60),
				date: Number.isFinite(t) ? new Date(t).toISOString() : null,
				url: String(f.url_alias || f.url || `https://reliefweb.int/disaster/${entry.id}`),
				glide: plain(f.glide, 40)
			};
		})
		.filter((d): d is Disaster => d !== null)
		.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export const reliefweb: Source<Disaster[]> = {
	name: 'reliefweb',
	label: 'Crisis y desastres activos · ReliefWeb (OCHA)',
	// La lista cambia poco y el límite va por appname: con 3 h de caché sobra.
	maxAgeMinutes: 180,
	async fetch() {
		const disasters = parseDisasters(await getJson<Raw>(RELIEFWEB_URL));
		if (!disasters.length) throw new Error('ReliefWeb no devuelve ningún desastre activo');
		return disasters;
	}
};

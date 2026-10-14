// Brotes de enfermedades según la OMS: Disease Outbreak News (https://www.who.int/emergencies/disease-outbreak-news),
// los partes oficiales sobre brotes con riesgo internacional (cólera, ébola, gripe aviar…). API pública
// OData de who.int, sin clave. Términos: contenido de la OMS reutilizable citando la fuente (CC BY-NC-SA
// 3.0 IGO); no publican límite por IP. Salen pocos partes a la semana, así que se pide cada 3 h.
import { getJson, list, plain, type Source } from '../lib.ts';

type Raw = Record<string, any>;

export interface OutbreakNews {
	/** Identificador del parte, p. ej. «2026-DON590». */
	id: string;
	title: string;
	/** Fecha de publicación en ISO (UTC). */
	date: string | null;
	/** Primeras frases del resumen, en texto plano. */
	summary: string;
	url: string;
}

export const WHO_URL =
	'https://www.who.int/api/emergencies/diseaseoutbreaknews?sf_culture=en&$orderby=PublicationDateAndTime%20desc&$top=20';

/** Convierte la respuesta OData en nuestra lista, de más reciente a más antiguo. */
export function parseWho(body: Raw): OutbreakNews[] {
	return list<Raw>(body?.value)
		.map((item): OutbreakNews | null => {
			const slug = String(item?.UrlName ?? item?.DonId ?? '').replace(/^\//, '');
			const title = plain(item?.OverrideTitle || item?.Title, 200);
			if (!slug || !title) return null;
			const t = Date.parse(item?.PublicationDateAndTime ?? item?.PublicationDate ?? '');
			return {
				id: String(item?.DonId || slug),
				title,
				date: Number.isFinite(t) ? new Date(t).toISOString() : null,
				summary: plain(item?.Summary ?? item?.Overview, 400),
				url: `https://www.who.int/emergencies/disease-outbreak-news/item/${slug}`
			};
		})
		.filter((n): n is OutbreakNews => n !== null)
		.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

export const who: Source<OutbreakNews[]> = {
	name: 'who-don',
	label: 'Brotes de enfermedades · OMS (Disease Outbreak News)',
	maxAgeMinutes: 180,
	async fetch() {
		const news = parseWho(await getJson<Raw>(WHO_URL));
		if (!news.length) throw new Error('La OMS no devuelve ningún parte de brotes');
		return news;
	}
};

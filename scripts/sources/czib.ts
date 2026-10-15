// F22: boletines de zonas de conflicto (CZIB) de la EASA, los activos. Sin clave ni API: se lee la tabla de la
// página pública https://www.easa.europa.eu/en/domains/air-operations/czibs (sondeada en el PR #415, responde
// desde Actions). Información pública de la UE; se enlaza cada boletín a su ficha oficial.
// Cada fila trae: fecha de emisión, de revisión (o N/A), validez (o N/A), zona, número y estado.
import { areaName, type Czib, type CzibData } from '../../src/lib/czib.ts';
import { getText, type Source } from '../lib.ts';

const PAGE = 'https://www.easa.europa.eu/en/domains/air-operations/czibs';

const DATE = String.raw`(\d{2}/\d{2}/\d{4}|N/A)`;
const ROW = new RegExp(String.raw`(\d{2}/\d{2}/\d{4})\s+${DATE}\s+(?:${DATE}\s+)?Airspace of\s+(.+?)\s+(CZIB-\d{4}-\d{2}\s*-?\s*R\d+)\s+(Active|Withdrawn)`, 'g');

const iso = (d: string | undefined) => (d && d !== 'N/A' ? `${d.slice(6, 10)}-${d.slice(3, 5)}-${d.slice(0, 2)}` : null);
/** «CZIB-2026-07R3» y «CZIB-2026-06-R2» → «CZIB-2026-07R3», «CZIB-2026-06R2». */
const cleanId = (id: string) => id.replace(/\s+/g, '').replace(/-R(\d+)$/, 'R$1');

/** Quita etiquetas y entidades: la tabla queda como texto seguido. */
export function toText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&#039;|&rsquo;/g, '’')
		.replace(/&ndash;/g, '–')
		.replace(/\s+/g, ' ');
}

/** Los CZIB activos de la página, con el enlace a su ficha (si sale en el HTML) o a la lista. */
export function parseCzibs(html: string): Czib[] {
	const links = new Map<string, string>();
	for (const m of html.matchAll(/href="([^"]*\/czibs\/(czib-[\w-]+))"/gi)) {
		links.set(m[2].toLowerCase().replace(/-r(\d+)$/, 'r$1'), new URL(m[1], PAGE).href);
	}
	const seen = new Set<string>();
	const items: Czib[] = [];
	for (const m of toText(html).matchAll(ROW)) {
		const [, issued, second, third, area, rawId, status] = m;
		if (status !== 'Active') continue;
		const id = cleanId(rawId);
		if (seen.has(id)) continue;
		seen.add(id);
		// Con tres fechas: emisión, revisión y validez. Con dos: emisión y validez (sin revisión).
		const [revised, valid] = third === undefined ? [null, second] : [second, third];
		const areaEn = area.trim();
		items.push({
			id,
			area: areaName(areaEn),
			areaEn,
			issued: iso(issued)!,
			revised: iso(revised ?? undefined),
			validUntil: iso(valid),
			url: links.get(id.toLowerCase()) ?? PAGE
		});
	}
	return items.sort((a, b) => (b.revised ?? b.issued).localeCompare(a.revised ?? a.issued));
}

export const czib: Source<CzibData> = {
	name: 'czib',
	label: 'Espacio aéreo en conflicto: boletines CZIB activos · EASA',
	maxAgeMinutes: 360,
	async fetch() {
		const items = parseCzibs(await getText(PAGE));
		if (!items.length) throw new Error('La página de la EASA no trae ningún CZIB activo (¿ha cambiado la tabla?)');
		return { items };
	}
};

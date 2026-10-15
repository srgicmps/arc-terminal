// NOVEDADES: lo fusionado en Arc Terminal la última semana, con la API de GitHub (los PR cerrados del
// propio repo). El repo es público y sin clave funciona, pero la API limita a 60 consultas por hora y
// por IP, que en Actions se comparte: con GITHUB_TOKEN (lo pone la Action) el límite es mucho mayor.
// El token va en una cabecera, nunca en la URL ni en los errores.
import type { Change, ChangesData } from '../../src/lib/types.ts';
import { getJson, plain, type Source } from '../lib.ts';

const REPO = 'srgicmps/arc-terminal';
const DAYS = 7;
/** Como mucho 10 páginas de 100 PR: con varias sesiones a la vez se cierran más de 150 al día. */
const PAGES = 10;

type RawPull = { number: number; title: string; merged_at: string | null; updated_at: string; html_url: string };

/**
 * Los PR fusionados desde `since`, de lo más reciente a lo más antiguo. Sin los «Tren N»: juntan otros PR
 * que GitHub también da por fusionados, así que cada cambio ya sale por su cuenta.
 */
export function merged(pulls: RawPull[], since: number): Change[] {
	return pulls
		.filter((p) => p.merged_at && Date.parse(p.merged_at) >= since && !/^tren\b/i.test(p.title.trim()))
		.map((p) => ({ number: p.number, title: plain(p.title, 200), mergedAt: p.merged_at!, url: p.html_url }))
		.sort((a, b) => b.mergedAt.localeCompare(a.mergedAt));
}

export const changes: Source<ChangesData> = {
	name: 'changes',
	label: 'Novedades · PR fusionados en Arc Terminal (API de GitHub)',
	maxAgeMinutes: 30,
	// El número de cambios sube y baja mucho de una semana a otra (o es cero): no es un fallo.
	allowEmpty: true,
	async fetch() {
		const token = process.env.GITHUB_TOKEN;
		const headers: Record<string, string> = {
			Accept: 'application/vnd.github+json',
			'X-GitHub-Api-Version': '2022-11-28'
		};
		if (token) headers.Authorization = `Bearer ${token}`;
		const since = Date.now() - DAYS * 86_400_000;
		const pulls: RawPull[] = [];
		// Ordenados por última actualización: un PR fusionado esta semana se actualizó esta semana, así que
		// se puede parar en cuanto la página acaba en algo más antiguo.
		for (let page = 1; page <= PAGES; page++) {
			const params = new URLSearchParams({
				state: 'closed',
				sort: 'updated',
				direction: 'desc',
				per_page: '100',
				page: String(page)
			});
			const batch = await getJson<RawPull[]>(`https://api.github.com/repos/${REPO}/pulls?${params}`, { headers });
			pulls.push(...batch);
			if (batch.length < 100 || Date.parse(batch.at(-1)!.updated_at) < since) break;
		}
		return { items: merged(pulls, since) };
	}
};

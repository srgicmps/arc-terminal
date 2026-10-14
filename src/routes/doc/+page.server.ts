// DOC lee archivos del propio repo para que lo que explica no se quede desfasado.
// Es +page.server.ts (no +page.ts) porque solo se ejecuta al construir la web: el navegador
// recibe el resultado ya preparado y no se descarga el código fuente entero.
import { dataset, type SourceStatus } from '#lib/data.ts';
import deployYml from '../../../.github/workflows/deploy.yml?raw';
import panelSrc from '#lib/components/Panel.svelte?raw';
import fuelLoadSrc from '../fuel/+page.ts?raw';
import fuelPageSrc from '../fuel/+page.svelte?raw';
import updateSrc from '../../../scripts/update.ts?raw';
import newsSrc from '../../../scripts/sources/news.ts?raw';
import newsListSrc from '#lib/components/NewsList.svelte?raw';
import watchlistSrc from '#lib/watchlist.svelte.ts?raw';
import type { PageServerLoad } from './$types';

export interface Excerpt {
	file: string;
	line: number;
	code: string;
}

/** Copia `count` líneas de un archivo a partir de la primera que contiene `marker`. */
function excerpt(file: string, src: string, marker: string, count = 1): Excerpt | null {
	const lines = src.split('\n');
	const start = lines.findIndex((l) => l.includes(marker));
	if (start < 0) return null;
	const picked = lines.slice(start, start + count);
	// Quita la sangría común para que el fragmento empiece pegado a la izquierda.
	const indent = Math.min(...picked.filter((l) => l.trim()).map((l) => l.match(/^\t*/)![0].length));
	return { file, line: start + 1, code: picked.map((l) => l.slice(indent).replaceAll('\t', '  ')).join('\n') };
}

export const load: PageServerLoad = async () => {
	const status = await dataset<SourceStatus[]>('status');
	return {
		sources: (status?.data ?? []).map(({ name, label, maxAgeMinutes, requires }) => ({ name, label, maxAgeMinutes, requires })),
		cron: [...deployYml.matchAll(/cron:\s*'([^']+)'/g)].map((m) => m[1]),
		secrets: [...new Set([...deployYml.matchAll(/secrets\.(\w+)/g)].map((m) => m[1]))],
		steps: [...deployYml.matchAll(/^\s*(?:-\s*)?run:\s*(.+)$/gm)].map((m) => m[1].trim()),
		snippets: {
			load: excerpt('src/routes/fuel/+page.ts', fuelLoadSrc, 'export const load', 4),
			state: excerpt('src/routes/fuel/+page.svelte', fuelPageSrc, '$state<FuelKey>', 2),
			derived: excerpt('src/routes/fuel/+page.svelte', fuelPageSrc, 'const provinces = $derived', 2),
			props: excerpt('src/lib/components/Panel.svelte', panelSrc, '= $props()', 1),
			snippet: excerpt('src/lib/components/Panel.svelte', panelSrc, '{#if note}', 3),
			store: excerpt('src/lib/watchlist.svelte.ts', watchlistSrc, 'export const watchlist = $state', 1),
			shrink: excerpt('scripts/update.ts', updateSrc, 'const suspicious = checkShrink', 2),
			requires: excerpt('scripts/update.ts', updateSrc, 'if (source.requires && !process.env', 3),
			cluster: excerpt('scripts/sources/news.ts', newsSrc, 'cluster(items)', 1),
			also: excerpt('src/lib/components/NewsList.svelte', newsListSrc, '{#if item.also?.length}', 3)
		}
	};
};

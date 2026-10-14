// Últimas versiones estables de las herramientas que usa Sergi, sacadas de los feeds Atom de releases
// de GitHub (https://github.com/{owner}/{repo}/releases.atom). Públicos y sin clave.
import type { Release } from '../../src/lib/types.ts';
import { getText, type Source } from '../lib.ts';
import { parseFeed } from './news.ts';

interface Tool {
	repo: string;
	name: string;
	/** Etiquetas que cuentan: en los monorepos (Vite, Svelte, Kit) hay releases de otros paquetes. */
	tag: RegExp;
}

const TOOLS: Tool[] = [
	{ repo: 'vuejs/core', name: 'Vue', tag: /^v(\d.*)$/ },
	{ repo: 'vitejs/vite', name: 'Vite', tag: /^v(\d.*)$/ },
	{ repo: 'microsoft/TypeScript', name: 'TypeScript', tag: /^v(\d.*)$/ },
	{ repo: 'sveltejs/svelte', name: 'Svelte', tag: /^svelte@(\d.*)$/ },
	{ repo: 'sveltejs/kit', name: 'SvelteKit', tag: /^@sveltejs\/kit@(\d.*)$/ },
	{ repo: 'nodejs/node', name: 'Node.js', tag: /^v(\d.*)$/ },
	{ repo: 'pnpm/pnpm', name: 'pnpm', tag: /^v(\d.*)$/ }
];

/** «3.5.22» → [3, 5, 22]. Compara versiones numéricas, parte a parte. */
export function compareVersions(a: string, b: string): number {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] || 0) - (pb[i] || 0);
		if (d) return d;
	}
	return 0;
}

/**
 * De un feed de releases, la versión estable más alta de la herramienta. Las prerelease (beta, rc…)
 * llevan un guion en la versión, según semver, y se descartan.
 */
export function latestRelease(body: string, tool: Tool): Release | null {
	let best: Release | null = null;
	for (const item of parseFeed(body, tool.repo)) {
		const tag = decodeURIComponent(item.url.split('/releases/tag/')[1] ?? '');
		const version = tool.tag.exec(tag)?.[1];
		if (!version || !/^\d+(\.\d+)*$/.test(version)) continue;
		if (best && compareVersions(version, best.version) <= 0) continue;
		best = { repo: tool.repo, name: tool.name, version, time: item.time, url: item.url };
	}
	return best;
}

export const releases: Source<Release[]> = {
	name: 'releases',
	label: `Versiones · releases de GitHub (${TOOLS.map((t) => t.repo).join(', ')})`,
	// Salen pocas versiones al día: con mirar cada 6 h basta.
	maxAgeMinutes: 360,
	async fetch(previous) {
		const results = await Promise.allSettled(
			TOOLS.map(async (tool) =>
				latestRelease(
					await getText(`https://github.com/${tool.repo}/releases.atom`, {
						headers: { Accept: 'application/atom+xml, application/xml' }
					}),
					tool
				)
			)
		);
		let ok = 0;
		const out: Release[] = [];
		results.forEach((r, i) => {
			const tool = TOOLS[i];
			// El feed solo trae las últimas 10 releases del repo: si no hay ninguna estable (o falla),
			// se queda la de la vez anterior.
			const old = previous?.find((p) => p.repo === tool.repo);
			if (r.status === 'rejected') console.log(`  releases · ${tool.repo}: ${r.reason?.message ?? r.reason}`);
			else ok++;
			const now = r.status === 'fulfilled' ? r.value : null;
			const pick = now && (!old || compareVersions(now.version, old.version) >= 0) ? now : old;
			if (pick) out.push(pick);
		});
		if (!ok) throw new Error('ningún feed de releases ha respondido');
		return out;
	}
};

<!--
	GEO, «Señales de riesgo»: cifras del día (catástrofes de GDACS, países sin internet según IODA y Cloudflare Radar, brotes de la
	OMS y países con aviso de viaje de nivel 4) y, debajo, lo más grave de cada una. Los datos llegan ya
	ordenados y recortados de riskSignals() (src/lib/risk-signals.ts).
-->
<script lang="ts">
	import { dm, nf } from '#lib/format.ts';
	import type { RiskSignals } from '#lib/risk-signals.ts';
	import Tile from './ui/Tile.svelte';
	import Tiles from './ui/Tiles.svelte';

	let { signals }: { signals: RiskSignals } = $props();

	const c = $derived(signals.counts);
	const LEVEL = { red: 'Roja', orange: 'Naranja', critical: 'Crítica', warning: 'Aviso' } as const;
</script>

<Tiles cols={4}>
	<Tile label="Catástrofes" value={nf(c.red + c.orange, 0)} tone={c.red ? 'down' : undefined} sub="{c.red} rojas · {c.orange} naranjas" />
	<Tile label="Sin internet" value={nf(c.outages, 0)} tone={c.outages ? 'down' : undefined} sub="países con caídas" />
	<Tile label="Brotes" value={nf(c.outbreaks, 0)} sub="partes de la OMS en 30 días" />
	<Tile label="No viajar" value={c.level4 === null ? '—' : nf(c.level4, 0)} tone={c.level4 === null ? 'mut' : undefined} sub="países en nivel 4" />
</Tiles>

{#if signals.disasters.length}
	<ul class="mini">
		{#each signals.disasters as e (e.id)}
			<li>
				<a class="l" href={e.url} target="_blank" rel="noopener">
					{e.kind} · {e.name}
					<small>{[e.country, e.severity].filter(Boolean).join(' · ')}</small>
				</a>
				<span class:mut={e.level !== 'red'}>{LEVEL[e.level]}</span>
			</li>
		{/each}
	</ul>
{/if}

{#if signals.outages.length}
	<ul class="mini">
		{#each signals.outages as o (o.code)}
			<li>
				<a class="l" href={o.url} target="_blank" rel="noopener">
					Internet · {o.country}
					<small>Desde el {dm(o.since)} · {o.signals.join(', ')}</small>
				</a>
				<span class:mut={o.level !== 'critical'}
					>{o.drop === null ? LEVEL[o.level] : `−${nf(o.drop, 0)} %`}</span
				>
			</li>
		{/each}
	</ul>
{/if}

{#if signals.verified.length}
	<ul class="mini">
		{#each signals.verified as o (o.id)}
			<li>
				<a class="l" href={o.url ?? 'https://radar.cloudflare.com/outage-center'} target="_blank" rel="noopener">
					Internet · {o.country}
					<small>{[o.cause, o.scope, 'Cloudflare Radar'].filter(Boolean).join(' · ')}</small>
				</a>
				<span class:mut={!!o.end}>{o.end ? `Hasta el ${dm(o.end)}` : 'En curso'}</span>
			</li>
		{/each}
	</ul>
{/if}

{#if signals.outbreaks.length}
	<ul class="mini">
		{#each signals.outbreaks as o (o.id)}
			<li>
				<a class="l" href={o.url} target="_blank" rel="noopener">
					{o.title}
					<small>Parte de la OMS</small>
				</a>
				<span class="mut">{o.date ? dm(o.date) : ''}</span>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.mini + .mini {
		border-top: var(--border);
	}
</style>

<!--
	TECH, «Ataques y cortes»: los países más atacados por DDoS en 7 días (capa 3, la red, o capa 7, la web) y los
	cortes de internet verificados de la semana. Datos de Cloudflare Radar (scripts/sources/radar.ts), ya con
	los países en español desde +page.server.ts. Sin el token CLOUDFLARE_RADAR_TOKEN no hay datos y no sale.
-->
<script lang="ts">
	import { dm, nf } from '#lib/format.ts';
	import type { RadarOutage, RadarTarget } from '#lib/types.ts';
	import Panel from './Panel.svelte';
	import Bar from './ui/Bar.svelte';
	import Seg from './ui/Seg.svelte';
	import Table from './ui/Table.svelte';
	import Updated from './Updated.svelte';

	interface Props {
		fetchedAt: string;
		l3: RadarTarget[];
		l7: RadarTarget[];
		outages: (RadarOutage & { country: string })[];
	}

	let { fetchedAt, l3, l7, outages }: Props = $props();

	const LAYERS = [
		{ value: 'l7', label: 'Web (capa 7)' },
		{ value: 'l3', label: 'Red (capa 3)' }
	] as const;
	let layer = $state<'l3' | 'l7'>('l7');
	const rows = $derived(layer === 'l3' ? l3 : l7);
	const max = $derived(Math.max(...rows.map((r) => r.pct), 0));
</script>

<Panel title="Ataques DDoS y cortes" meta="Países más atacados en 7 días · Cloudflare Radar">
	<div class="layers"><Seg label="Tipo de ataque" options={LAYERS} bind:value={layer} /></div>
	{#if rows.length}
		<Table>
			<thead>
				<tr><th class="l">País atacado</th><th>% del total</th><th class="sp"><span class="sr">Comparación</span></th></tr>
			</thead>
			<tbody>
				{#each rows as r (r.code)}
					<tr>
						<td class="name">{r.name}</td>
						<td>{nf(r.pct, 1)} %</td>
						<td class="sp"><Bar pct={max ? (r.pct / max) * 100 : 0} /></td>
					</tr>
				{/each}
			</tbody>
		</Table>
	{:else}
		<p class="empty">Sin ranking de ataques.</p>
	{/if}
	{#if outages.length}
		<ul class="mini">
			{#each outages as o (o.id)}
				<li>
					<a class="l" href={o.url ?? 'https://radar.cloudflare.com/outage-center'} target="_blank" rel="noopener">
						{o.country}
						<small>{[o.cause, o.scope, ...o.networks].filter(Boolean).join(' · ')}</small>
					</a>
					<span class:mut={!!o.end}>{o.end ? [...new Set([dm(o.start), dm(o.end)])].join('–') : `En curso desde el ${dm(o.start)}`}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet note()}
		Ataques: parte de cada país en el total de ataques DDoS que mitiga Cloudflare. Cortes: los de la semana que
		Cloudflare ha verificado, con su causa. Fuente:
		<a href="https://radar.cloudflare.com" target="_blank" rel="noopener">Cloudflare Radar</a> (CC BY-NC 4.0) ·
		<Updated at={fetchedAt} source="radar" />
	{/snippet}
</Panel>

<style>
	.layers {
		padding: var(--sp-8) var(--pad-x);
		border-bottom: var(--border);
	}

	.sp {
		width: 40%;
		min-width: 60px;
	}

	@container (max-width: 480px) {
		.sp {
			display: none;
		}
	}

	.mini {
		border-top: var(--border);
	}
</style>

<!--
	Gasto militar por país (SIPRI): puesto, gasto en miles de millones de dólares, % del PIB y variación real
	frente al año anterior. El nombre enlaza a la ficha PAIS si la terminal conoce el país.
	La variación va sin verde ni rojo: que suba el gasto militar no es una buena ni una mala noticia en sí.
-->
<script lang="ts">
	import { COUNTRIES } from '#lib/countries.ts';
	import { nf, signed } from '#lib/format.ts';
	import type { MilexRow } from '#lib/milex.ts';
	import { routeHref } from '#lib/routes.ts';
	import Table from './ui/Table.svelte';

	let { rows }: { rows: MilexRow[] } = $props();

	const known = new Set(COUNTRIES.map((c) => c.code));
	const href = (code: string) => `${routeHref('/pais')}?c=${code}`;
</script>

{#if rows.length}
	<Table>
		<thead>
			<tr><th>#</th><th class="l">País</th><th>Miles de M$</th><th>% PIB</th><th>Var. real</th></tr>
		</thead>
		<tbody>
			{#each rows as r (r.name)}
				<tr>
					<td class="mut">{r.rank}</td>
					<td class="l name">{#if r.code && known.has(r.code)}<a href={href(r.code)}>{r.name}</a>{:else}{r.name}{/if}</td>
					<td>{nf(r.usd / 1000, 1)}</td>
					<td>{r.gdp === null ? '—' : `${nf(r.gdp, 1)} %`}</td>
					<td class="mut">{r.real === null ? '—' : `${signed(r.real, 1)} %`}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	a {
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		color: var(--amber);
	}
</style>

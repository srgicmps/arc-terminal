<!--
	Avisos de viaje del Departamento de Estado de EE. UU. (GEO): cuántos países hay en cada nivel y los cambios
	de los últimos 30 días. Cada país que conoce la terminal enlaza a su ficha PAIS.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { LEVELS } from '#lib/advisories.ts';
	import { dm } from '#lib/format.ts';
	import Table from './ui/Table.svelte';

	export interface AdvisoryRow {
		/** Nombre en español si la terminal conoce el país; si no, el del Departamento de Estado. */
		name: string;
		/** ISO2, para enlazar con PAIS. */
		code?: string;
		level: 1 | 2 | 3 | 4;
		prevLevel?: 1 | 2 | 3 | 4;
		/** Fecha del cambio de nivel o, si no lo hubo, de la última actualización. */
		date: string;
		url: string;
	}

	let { counts, rows }: { counts: [number, number, number, number]; rows: AdvisoryRow[] } = $props();
</script>

<ul class="levels">
	{#each counts as n, i (i)}
		<li class="lv-{i + 1}"><b>{n}</b> nivel {i + 1} · {LEVELS[(i + 1) as 1 | 2 | 3 | 4]}</li>
	{/each}
</ul>

{#if rows.length}
	<Table>
		<thead><tr><th>Cambios · 30 días</th><th>Nivel</th><th>Fecha</th></tr></thead>
		<tbody>
			{#each rows as r (r.name)}
				<tr>
					<td class="name">
						{#if r.code}<a href="{resolve('/pais')}?c={r.code}">{r.name}</a>{:else}<a href={r.url} target="_blank" rel="noopener">{r.name}</a>{/if}
					</td>
					<td class="lv-{r.level}" title={LEVELS[r.level]}>{#if r.prevLevel}<span class="mut">{`${r.prevLevel} → `}</span>{/if}{r.level}</td>
					<td class="mut">{dm(r.date)}</td>
				</tr>
			{/each}
		</tbody>
	</Table>
{:else}
	<p class="empty">Ningún aviso ha cambiado en los últimos 30 días.</p>
{/if}

<style>
	.levels {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-4) var(--sp-14);
		margin: 0;
		padding: var(--sp-8) var(--pad-x);
		list-style: none;
		border-bottom: var(--border);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.levels b {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	a {
		color: inherit;
		text-decoration: none;
	}

	a:hover {
		color: var(--amber);
	}

	/* Nivel 4 («no viajar») en rojo; el resto, sin color: solo se marca lo grave. */
	.lv-4,
	.levels .lv-4 b {
		color: var(--down);
	}
</style>

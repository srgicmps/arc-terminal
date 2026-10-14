<!--
	ECO, «Estrés financiero» (panel provisional): CISS del BCE (zona euro) y STLFSI4 de la Fed de San Luis
	(EE. UU.), con su último dato, la evolución reciente y si están en zona alta. Las reglas, en src/lib/stress.ts.
	Si no llega ninguna de las dos series, no se pinta nada.
-->
<script lang="ts">
	import type { Dataset } from '#lib/data.ts';
	import { nf, period } from '#lib/format.ts';
	import { financialStress } from '#lib/stress.ts';
	import type { SeriesData } from '#lib/types.ts';
	import Panel from './Panel.svelte';
	import Spark from './Spark.svelte';
	import Updated from './Updated.svelte';
	import Table from './ui/Table.svelte';

	interface Props {
		/** Del BCE basta con «ciss-ea»; de FRED, con «stlfsi-us» (recortadas en +page.server.ts). */
		ecb: Dataset<SeriesData> | null;
		fred: Dataset<SeriesData> | null;
	}

	let { ecb, fred }: Props = $props();

	const rows = $derived(
		financialStress((id) => [...(ecb?.data.series ?? []), ...(fred?.data.series ?? [])].find((s) => s.id === id))
	);
</script>

{#if rows.length}
	<Panel title="Estrés financiero" meta="Zona euro y EE. UU.">
		<Table>
			<thead>
				<tr>
					<th class="l">Índice</th>
					<th>Último</th>
					<th class="sp"><span class="sr">Evolución reciente</span></th>
					<th>Estado</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as r (r.id)}
					<tr>
						<td class="l">
							<a class="name" href={r.series.url} target="_blank" rel="noopener">{r.name}</a>
							<span class="sub">{period(r.date)}</span>
						</td>
						<td>{nf(r.last, r.decimals)}</td>
						<td class="sp"><Spark values={r.series.points.map((p) => p.v)} /></td>
						<td class:on={r.high} class:mut={!r.high} title="Alto si {r.rule}">{r.high ? 'alto' : 'normal'}</td>
					</tr>
				{/each}
			</tbody>
		</Table>
		{#snippet note()}
			CISS: estrés sistémico de la zona euro (bolsa, bonos, divisas, banca y dinero), de 0 a 1; alto desde 0,40
			(≈0,8 en 2008, ≈0,5 en 2020). Fed de San Luis: 0 es lo normal y cada punto, una desviación típica; alto por
			encima de 1. Fuentes: BCE (CISS){#if ecb} · <Updated at={ecb.fetchedAt} source="ecb" />{/if} y FRED, Fed de
			San Luis (usa su API sin estar respaldado por ella){#if fred} · <Updated at={fred.fetchedAt} source="fred" />{/if}
		{/snippet}
	</Panel>
{/if}

<style>
	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.on {
		color: var(--amber);
	}

	.sp {
		width: 80px;
		padding-block: 0;
	}

	@container (max-width: 300px) {
		.sp {
			display: none;
		}
	}
</style>

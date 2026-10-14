<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { when } from '#lib/format.ts';
	import Table from '#lib/components/ui/Table.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const rows = $derived(data.status?.data ?? []);
	const LABEL = { ok: 'Al día', cached: 'Al día', stale: 'Copia anterior', error: 'Sin datos', off: 'Sin clave' };
	const ok = $derived(rows.filter((r) => r.state === 'ok' || r.state === 'cached').length);
	// Las fuentes sin clave no son un fallo: no cuentan en el total.
	const active = $derived(rows.filter((r) => r.state !== 'off').length);
</script>

<ViewHeader code="STATUS" title="Estado de las fuentes" sub="Qué tal fue la última descarga de cada fuente de datos" />

<div class="grid">
	<div class="col">
		<Panel title="Fuentes" meta="{ok} de {active} al día">
			{#if rows.length}
				<Table>
					<thead><tr><th>Fuente</th><th class="l">Qué trae</th><th>Estado</th><th>Datos de</th></tr></thead>
					<tbody>
						{#each rows as r (r.name)}
							<tr>
								<td class="mut">{r.name}</td>
								<td class="l wrap">{r.label}{#if r.error}<small class:off={r.state === 'off'}>{r.error}</small>{/if}</td>
								<td class={r.state === 'ok' || r.state === 'cached' ? 'up' : r.state === 'off' ? 'mut' : 'down'}>{LABEL[r.state]}</td>
								<td class="mut">{when(r.fetchedAt, clock.now)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}
				Cada 15 minutos, GitHub Actions descarga las fuentes. Las que cambian poco (Eurostat, BLS) se
				reutilizan unas horas. Si una falla, se mantiene su última copia.
			{/snippet}
		</Panel>
	</div>
</div>

<style>
	.wrap {
		white-space: normal;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	small {
		display: block;
		color: var(--down);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	small.off {
		color: var(--muted);
	}
</style>

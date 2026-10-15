<!--
	HDS: qué fondos de FONDOS tienen un valor (/hds?s=NVDA). Se invierten sus carteras 13F (src/lib/holders.ts).
	Sin búsqueda, los valores que más fondos comparten.
-->
<script lang="ts">
	import HoldersTable from '#lib/components/HoldersTable.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Search from '#lib/components/ui/Search.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { compact, period } from '#lib/format.ts';
	import { findIssuers, mostShared } from '#lib/holders-search.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Lo buscado va en la URL (/hds?s=NVDA), para compartirlo.
	const sel = urlState<string>('s', '', (v) => v.trim().length > 0);

	const issuers = $derived(data.hds?.issuers ?? []);
	const names = $derived(Object.fromEntries((data.hds?.funds ?? []).map((f) => [f.key, f.name])));
	const found = $derived(findIssuers(sel.value, issuers).slice(0, 8));
	const shared = $derived(mostShared(issuers));
	const ticker = $derived(TICKERS.find((t) => t.code === sel.value.trim().toUpperCase()));

	/** «2026-06-30» → «T2 2026». */
	const quarter = (date: string) => (date ? `T${Math.ceil(Number(date.slice(5, 7)) / 3)} ${date.slice(0, 4)}` : '—');
	const quarters = $derived([...new Set((data.hds?.funds ?? []).map((f) => quarter(f.period)))].join(', '));
	const lastFiled = $derived((data.hds?.funds ?? []).map((f) => f.filed).sort().at(-1) ?? '');
</script>

<ViewHeader code="HDS" title="Quién tiene el valor" sub="Qué fondos de FONDOS lo tienen, según su último 13F en la SEC" />

<div class="find">
	<Search label="Buscar un valor por código o nombre" placeholder="NVDA, Apple, Kraft…" bind:value={sel.value} />
</div>

{#snippet source()}
	Solo los fondos de FONDOS ({Object.keys(names).length}) y sus {data.hds?.top ?? 100} mayores posiciones; cada fondo declara el trimestre
	{quarters || '—'} con hasta 45 días de retraso{lastFiled ? ` (último, ${period(lastFiled)})` : ''}: no es la cartera de hoy.
	Fuente: SEC EDGAR (13F) · <Updated at={data.hds?.fetchedAt} source="funds" />
{/snippet}

{#if !data.hds}
	<p class="empty">Sin datos todavía: hace falta la clave SEC_USER_AGENT en la terminal.</p>
{:else}
	<div class="grid grid-2">
		<div class="col">
			{#if sel.value.trim()}
				{#each found as issuer (issuer.cusip)}
					<Panel title="Quién lo tiene" meta="{issuer.name} · {issuer.holders.length} {issuer.holders.length === 1 ? 'fondo' : 'fondos'} · {compact(issuer.total)} $">
						<HoldersTable holders={issuer.holders} {names} />
						{#snippet note()}{@render source()}{/snippet}
					</Panel>
				{:else}
					<Panel title="Quién lo tiene" meta="{ticker?.name ?? sel.value} · sin fondos">
						<p class="empty">Ninguno de los fondos de FONDOS lo tiene entre sus {data.hds?.top ?? 100} mayores posiciones.</p>
					</Panel>
				{/each}
			{:else}
				<p class="empty">Escribe un código (NVDA) o parte del nombre (Kraft) para ver qué fondos lo tienen.</p>
			{/if}
		</div>
		<div class="col">
			<Panel title="Los más repartidos" meta="En más fondos a la vez">
				<Table>
					<thead><tr><th class="l">Valor</th><th>Fondos</th><th>Entre todos</th></tr></thead>
					<tbody>
						{#each shared as e (e.cusip)}
							<tr>
								<td class="l name"><button type="button" class="pick" onclick={() => (sel.value = e.name)}>{e.name}</button></td>
								<td>{e.holders.length}</td>
								<td class="mut">{compact(e.total)} $</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}{@render noteText()}{/snippet}
			</Panel>
		</div>
	</div>
{/if}

{#snippet noteText()}Pulsa un valor para ver quién lo tiene · <Updated at={data.hds?.fetchedAt} source="funds" />{/snippet}

<style>
	.find {
		margin-bottom: var(--sp-12);
	}

	.pick {
		padding: 0;
		background: none;
		border: 0;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pick:hover {
		color: var(--amber);
	}
</style>

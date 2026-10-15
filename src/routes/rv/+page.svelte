<!--
	RV: un valor frente a sus competidores (/rv?s=NVDA). Cifras de Finnhub (perf.json) y competidores de
	Finnhub (peers.json); la comparación, en src/lib/rv.ts. Solo valores grandes de EE. UU.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Panel from '#lib/components/Panel.svelte';
	import RvTable from '#lib/components/RvTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { compact, nf } from '#lib/format.ts';
	import { compareWithPeers } from '#lib/rv.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const metrics = $derived(data.rv?.metrics ?? {});
	const codes = $derived(Object.keys(data.rv?.peers ?? {}).sort());
	const sel = urlState<string>('s', 'NVDA', (v) => v.trim().length > 0);
	const code = $derived(sel.value.trim().toUpperCase());
	const peerList = $derived(data.rv?.peers[code] ?? []);
	const cmp = $derived(compareWithPeers(code, peerList, metrics));
	const without = $derived(peerList.filter((p) => !metrics[p]));
	const name = (c: string) => TICKERS.find((t) => t.code === c)?.name ?? c;
	const fmt = (v: number | null | undefined, unit = '', d = 1) => (v == null ? '—' : `${nf(v, d)}${unit}`);

	let text = $state('');
	$effect(() => {
		text = code;
	});
	function apply(event: SubmitEvent) {
		event.preventDefault();
		if (text.trim()) sel.value = text.trim().toUpperCase();
	}
</script>

<ViewHeader code="RV" title="Frente a su sector" sub="Valoración, márgenes y crecimiento frente a sus competidores · Finnhub" />

<form class="controls" onsubmit={apply}>
	<input type="text" bind:value={text} list="rv-codes" placeholder="NVDA" aria-label="Valor que comparar" autocapitalize="characters" spellcheck="false" />
	<datalist id="rv-codes">{#each codes as c (c)}<option value={c}></option>{/each}</datalist>
	<button type="submit" class="go">Comparar</button>
</form>

{#snippet source()}
	Cifras de los últimos 12 meses al último cierre; mediana de los competidores con datos. En verde, mejor que la
	mediana (PER bajo, margen alto…). Solo unos 60 grandes valores de EE. UU. Fuente: Finnhub ·
	<Updated at={data.rv?.fetchedAt} source="perf" />
{/snippet}

{#if !data.rv}
	<p class="empty">Sin datos todavía: hace falta la clave FINNHUB_API_KEY en la terminal.</p>
{:else if !metrics[code]}
	<p class="empty">Sin cifras de {code}: RV solo tiene unos 60 grandes valores de EE. UU. Prueba con {codes.slice(0, 6).join(', ')}…</p>
{:else}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="Frente a su sector" meta="{code} · {name(code)} · {cmp.peers.length} competidores con datos">
				<RvTable rows={cmp.rows} />
				{#snippet note()}{@render source()}{/snippet}
			</Panel>
		</div>
		<div class="col">
			<Panel title="Competidores" meta="Según Finnhub">
				<Table>
					<thead><tr><th class="l">Valor</th><th>PER</th><th>Margen</th><th>Ventas</th><th>Capitalización</th></tr></thead>
					<tbody>
						{#each [code, ...cmp.peers] as c (c)}
							{@const m = metrics[c]}
							<tr class:own={c === code}>
								<td class="l name"><a href="{resolve('/rv')}?s={encodeURIComponent(c)}">{c}</a>{#if name(c) !== c}<span class="sub">{name(c)}</span>{/if}</td>
								<td>{fmt(m?.pe, '×')}</td>
								<td>{fmt(m?.margin, ' %')}</td>
								<td>{fmt(m?.revGrowth, ' %')}</td>
								<td class="mut">{m?.cap == null ? '—' : `${compact(m.cap * 1e6)} $`}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					{#if without.length}Sin datos (fuera de la lista): {without.join(', ')}. {/if}Ventas: crecimiento en 12 meses ·
					<Updated at={data.rv?.peersAt} source="peers" />
				{/snippet}
			</Panel>
		</div>
	</div>
{/if}

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		margin-bottom: var(--sp-12);
	}

	input {
		flex: 1 1 200px;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		font-family: var(--mono);
		font-size: var(--fs-l);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	tr.own td {
		color: var(--amber);
	}
</style>

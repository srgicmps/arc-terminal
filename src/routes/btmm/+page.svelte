<script lang="ts">
	import MoneyTable from '#lib/components/MoneyTable.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { signed } from '#lib/format.ts';
	import { moneyPhrase, phrases } from '#lib/plain.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Modo Sencillo: ¿hay tensión en el dinero a un día? En EE. UU. (SOFR − IORB) y en la zona euro (€STR − depósito).
	const plain = $derived(phrases([moneyPhrase('us', data.sofrIorb), moneyPhrase('ea', data.estrDfr)]));

	const pb = (v: number | null) => (v === null ? '—' : `${signed(v, 0)} pb`);
</script>

<ViewHeader code="BTMM" title="Mercado monetario" sub="Fed de Nueva York, FRED, Tesoro de EE. UU. y BCE" {plain} />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="EE. UU." meta="SOFR − IORB {pb(data.sofrIorb)}">
			<MoneyTable rows={data.usRows} />
			{#snippet note()}
				SOFR, TGCR, BGCR, EFFR y OBFR: Fed de Nueva York, con el volumen en miles de millones de dólares. Letras: Tesoro.
				SOFR por encima de IORB, tensión en la financiación a corto. · <Updated at={data.fetchedAt.us} source="nyfed" />
			{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Zona euro" meta="SOFR − €STR {pb(data.sofrEstr)}">
			<MoneyTable rows={data.eaRows} />
			{#snippet note()}
				Euríbor: media mensual del BCE. Curva AAA: bonos de los gobiernos de la zona con AAA. · <Updated at={data.fetchedAt.ea} source="ecb" />
			{/snippet}
		</Panel>
	</div>
</div>

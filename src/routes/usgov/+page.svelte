<script lang="ts">
	import DocList from '#lib/components/DocList.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const us = new Set(['Casa Blanca', 'Reserva Federal']);
	const official = $derived((data.gov?.data.items ?? []).filter((i) => us.has(i.source)));
</script>

<ViewHeader
	code="USGOV"
	title="Gobierno de EE. UU."
	sub="Federal Register (el «BOE» de EE. UU.), Casa Blanca y Reserva Federal"
/>

<div class="grid grid-2">
	<div class="col">
		<Panel title="Documentos presidenciales" meta="Órdenes ejecutivas, proclamaciones, memorandos">
			<DocList docs={data.fedreg?.data.presidential ?? []} />
			{#snippet note()}Fuente: Federal Register · <Updated at={data.fedreg?.fetchedAt} source="fedreg" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Casa Blanca y Fed" meta="Comunicados">
			<NewsList items={official.slice(0, 20)} />
		</Panel>
		<Panel title="Normas nuevas" meta="Reglamentos definitivos">
			<DocList docs={data.fedreg?.data.rules ?? []} />
		</Panel>
	</div>
</div>

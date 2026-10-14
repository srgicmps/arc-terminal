<!-- PORT: barcos en puertos y estrechos, con los mensajes AIS de aisstream.io. -->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ShipTable from '#lib/components/ShipTable.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const ports = $derived(data.ships?.data.ports ?? []);
	const total = $derived(ports.reduce((n, p) => n + p.total, 0));
</script>

<ViewHeader code="PORT" title="Puertos y estrechos" sub="Barcos que emiten AIS ahora mismo · aisstream.io" />

<div class="grid">
	<div class="col">
		<Panel title="Barcos" meta={data.ships ? `${total} detectados en ${data.ships.data.listened} s de escucha` : undefined}>
			{#if data.ships}
				<ShipTable {ports} />
			{:else}
				<p class="empty">Sin datos de AIS por ahora.</p>
			{/if}
			{#snippet note()}
				Fuente: <a href="https://aisstream.io" target="_blank" rel="noopener">aisstream.io</a>, con receptores AIS de voluntarios: datos tal cual, sin
				garantía, y solo de los barcos que emiten AIS · <Updated at={data.ships?.fetchedAt} source="ais" />
			{/snippet}
		</Panel>
	</div>
</div>

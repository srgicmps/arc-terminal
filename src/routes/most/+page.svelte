<!--
	MOST: los que más suben, bajan y se negocian hoy (widget «hotlists» de TradingView, sin clave), con las tres
	bolsas una al lado de otra. El mismo componente sale en WS con un selector de bolsa.
-->
<script lang="ts">
	import HotLists from '#lib/components/HotLists.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';

	const BOLSAS = [
		{ exchange: 'US', title: 'EE. UU.', meta: 'NYSE, Nasdaq y AMEX' },
		{ exchange: 'XETR', title: 'Alemania', meta: 'Xetra' },
		{ exchange: 'BME', title: 'España', meta: 'Bolsa de Madrid' }
	] as const;
</script>

<ViewHeader code="MOST" title="Los que más se mueven" sub="Suben, bajan y más negociados hoy · TradingView, en directo" />

<div class="grid grid-3">
	{#each BOLSAS as b (b.exchange)}
		<div class="col">
			<Panel title={b.title} meta="{b.meta} · hoy">
				<HotLists exchange={b.exchange} height={520} />
			</Panel>
		</div>
	{/each}
</div>

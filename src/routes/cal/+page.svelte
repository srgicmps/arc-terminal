<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';

	const calendar = {
		importanceFilter: '0,1',
		countryFilter: 'us,eu,es,de,fr,it,gb,cn,jp'
	};
</script>

<ViewHeader code="CAL" title="Agenda económica" sub="Datos macro de la semana, con previsión y resultado · TradingView" />

<div class="grid">
	<div class="col">
		<Panel title="Calendario" meta="Importancia media y alta · hora local">
			<TvWidget widget="events" config={calendar} height={720} />
		</Panel>
	</div>
</div>

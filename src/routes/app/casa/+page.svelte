<!--
	Tu casa (app Sencilla): la luz más barata de hoy, la gasolina, el tiempo, el aire y el polen de «Tu sitio», y los
	avisos del tiempo. Arriba, el sitio elegido y el botón para cambiarlo.
-->
<script lang="ts">
	import HomeCards from '#lib/components/sencillo/HomeCards.svelte';
	import PlacePicker from '#lib/components/PlacePicker.svelte';
	import Section from '#lib/components/sencillo/Section.svelte';
	import AlertsSummary from '#lib/components/sencillo/AlertsSummary.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>Arc · Tu casa</title>
</svelte:head>

<header class="head">
	<h1>Tu casa</h1>
	<div class="where"><PlacePicker /></div>
</header>

<div class="stack">
	<HomeCards {data} full />
	<Section title="Avisos del tiempo" icon="sun">
		<AlertsSummary weather={data.alerts} />
	</Section>
</div>

<style>
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		margin-bottom: var(--sp-16);
	}

	h1 {
		margin: 0;
		font-size: var(--app-fs-h1);
	}

	.stack {
		display: grid;
		gap: var(--sp-16);
	}
</style>

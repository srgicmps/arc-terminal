<script lang="ts">
	import HnTable from '#lib/components/HnTable.svelte';
	import LaunchesPanel from '#lib/components/LaunchesPanel.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuoteBoard from '#lib/components/QuoteBoard.svelte';
	import ReleaseList from '#lib/components/ReleaseList.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { BIG_TECH } from '#lib/tickers/bigtech.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="TECH" title="Tecnología" sub="Hacker News, {sources}" />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Titulares" meta="Tecnología">
			<NewsList items={data.news?.data.items ?? []} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-tech" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Tecnológicas en bolsa" meta="TradingView · toca un código para su ficha">
			<QuoteBoard name="Tecnológicas" codes={BIG_TECH} />
		</Panel>
		<LaunchesPanel />
		<Panel title="Hacker News" meta="Portada, por puntos">
			<HnTable items={data.hn?.data ?? []} />
			{#snippet note()}Fuente: Hacker News (API de Algolia) · <Updated at={data.hn?.fetchedAt} source="hn" />{/snippet}
		</Panel>
		<Panel title="Versiones" meta="Última estable · ámbar: últimos 7 días">
			<ReleaseList items={data.releases?.data ?? []} />
			{#snippet note()}Fuente: releases de GitHub · <Updated at={data.releases?.fetchedAt} source="releases" />{/snippet}
		</Panel>
	</div>
</div>

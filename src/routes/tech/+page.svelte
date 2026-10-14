<script lang="ts">
	import HnTable from '#lib/components/HnTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.count).map((f) => f.name).join(', '));
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
		<Panel title="Hacker News" meta="Portada, por puntos">
			<HnTable items={data.hn?.data ?? []} />
			{#snippet note()}Fuente: Hacker News (API de Algolia) · <Updated at={data.hn?.fetchedAt} source="hn" />{/snippet}
		</Panel>
	</div>
</div>

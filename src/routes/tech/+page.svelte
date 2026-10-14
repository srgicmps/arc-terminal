<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import HnTable from '#lib/components/HnTable.svelte';
	import KevTable from '#lib/components/KevTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ReleaseList from '#lib/components/ReleaseList.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Vulnerabilidades añadidas hoy (día UTC, el de la CISA). Solo se destacan a partir de 3, y solo si los
	// datos son de hoy: clock.now vale 0 al construir, así que el HTML estático sale sin destacar.
	const HOT = 3;
	const kev = $derived(data.kev?.data);
	const kevToday = $derived(
		kev && clock.now && kev.day === new Date(clock.now).toISOString().slice(0, 10) ? kev.today : 0
	);

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
		<Panel title="Hacker News" meta="Portada, por puntos">
			<HnTable items={data.hn?.data ?? []} />
			{#snippet note()}Fuente: Hacker News (API de Algolia) · <Updated at={data.hn?.fetchedAt} source="hn" />{/snippet}
		</Panel>
		<Panel
			title="Vulnerabilidades explotadas (CISA)"
			meta={kevToday >= HOT ? `${kevToday} nuevas hoy` : kev ? `${kev.total} en el catálogo` : undefined}
			accent={kevToday >= HOT}
		>
			<KevTable items={kev?.items ?? []} />
			{#snippet note()}
				Catálogo KEV de la <a href="https://www.cisa.gov/known-exploited-vulnerabilities-catalog" target="_blank" rel="noopener">CISA</a>: fallos que
				ya se están aprovechando. Cada CVE enlaza a su ficha en el NVD · <Updated at={data.kev?.fetchedAt} source="cisa-kev" />
			{/snippet}
		</Panel>
		<Panel title="Versiones" meta="Última estable · ámbar: últimos 7 días">
			<ReleaseList items={data.releases?.data ?? []} />
			{#snippet note()}Fuente: releases de GitHub · <Updated at={data.releases?.fetchedAt} source="releases" />{/snippet}
		</Panel>
	</div>
</div>

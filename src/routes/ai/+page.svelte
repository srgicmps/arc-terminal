<script lang="ts">
	import HnTable from '#lib/components/HnTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PaperList from '#lib/components/PaperList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuoteBoard from '#lib/components/QuoteBoard.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { BIG_TECH } from '#lib/tickers/bigtech.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// De la portada de Hacker News, lo que habla de IA.
	const AI = /\b(ai|a\.i\.|llms?|gpt|openai|anthropic|claude|gemini|llama|mistral|deepseek|transformer|neural|machine learning|agents?|diffusion|copilot|inference|model)\b/i;
	const hnAi = $derived((data.hn?.data ?? []).filter((i) => AI.test(i.title)));
	const papers = $derived(data.papers?.data ?? []);
	const sources = $derived((data.news?.data.feeds ?? []).filter((f) => f.items).map((f) => f.name).join(', '));
</script>

<ViewHeader code="AI" title="Inteligencia artificial" sub={sources} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Titulares" meta="IA">
			<NewsList items={data.news?.data.items ?? []} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-ai" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Tecnológicas en bolsa" meta="TradingView · toca un código para su ficha">
			<QuoteBoard name="Tecnológicas" codes={BIG_TECH} />
		</Panel>
		<Panel title="IA en Hacker News" meta="{hnAi.length} en portada">
			<HnTable items={hnAi} />
		</Panel>
		<Panel title="Papers del día · Hugging Face" meta={papers.length ? `${papers.length} papers` : undefined}>
			<PaperList items={papers} empty={data.papers ? 'Hoy no hay papers en la lista de Hugging Face.' : undefined} />
			{#snippet note()}<Updated at={data.papers?.fetchedAt} source="hfpapers" />{/snippet}
		</Panel>
	</div>
</div>

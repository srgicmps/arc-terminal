<script lang="ts">
	import HnTable from '#lib/components/HnTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PaperList from '#lib/components/PaperList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuoteBoard from '#lib/components/QuoteBoard.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { compact } from '#lib/format.ts';
	import { BIG_TECH } from '#lib/tickers/bigtech.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// De la portada de Hacker News, lo que habla de IA.
	const AI = /\b(ai|a\.i\.|llms?|gpt|openai|anthropic|claude|gemini|llama|mistral|deepseek|transformer|neural|machine learning|agents?|diffusion|copilot|inference|model)\b/i;
	const hnAi = $derived((data.hn?.data ?? []).filter((i) => AI.test(i.title)));
	const papers = $derived(data.papers?.data ?? []);
	const models = $derived(data.models?.data ?? []);

	// Tareas de Hugging Face más comunes en la tendencia; las demás salen tal cual.
	const TASKS: Record<string, string> = {
		'text-generation': 'Texto',
		'image-text-to-text': 'Imagen y texto',
		'text-to-image': 'Texto a imagen',
		'image-to-image': 'Imagen a imagen',
		'text-to-video': 'Texto a vídeo',
		'image-to-video': 'Imagen a vídeo',
		'text-to-speech': 'Texto a voz',
		'automatic-speech-recognition': 'Voz a texto',
		'any-to-any': 'Multimodal',
		'feature-extraction': 'Embeddings',
		'sentence-similarity': 'Embeddings',
		'image-classification': 'Clasificar imágenes',
		'text-classification': 'Clasificar texto',
		translation: 'Traducción',
		robotics: 'Robótica'
	};
	const task = (t: string) => (t ? (TASKS[t] ?? t) : '—');
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
		<Panel title="Modelos en tendencia · Hugging Face" meta={models.length ? `${models.length} modelos` : undefined}>
			{#if models.length}
				<Table>
					<thead>
						<tr><th>Modelo</th><th class="l wide">Tarea</th><th>Likes</th><th>Descargas</th></tr>
					</thead>
					<tbody>
						{#each models as m (m.id)}
							<tr>
								<td class="name mname" title={m.id}
									><a class="model" href={m.url} target="_blank" rel="noopener">{m.name}</a><span class="sub"
										>{m.author}</span
									></td
								>
								<td class="l mut wide">{task(m.task)}</td>
								<td>{compact(m.likes)}</td>
								<td class="mut">{compact(m.downloads)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">Sin datos todavía.</p>
			{/if}
			{#snippet note()}Descargas del último mes · <Updated at={data.models?.fetchedAt} source="hfmodels" />{/snippet}
		</Panel>
		<Panel title="Papers del día · Hugging Face" meta={papers.length ? `${papers.length} papers` : undefined}>
			<PaperList items={papers} empty={data.papers ? 'Hoy no hay papers en la lista de Hugging Face.' : undefined} />
			{#snippet note()}<Updated at={data.papers?.fetchedAt} source="hfpapers" />{/snippet}
		</Panel>
	</div>
</div>

<style>
	.model {
		color: var(--fg);
		text-decoration: none;
	}

	.model:hover {
		color: var(--amber);
	}

	/* En el móvil, la tabla de modelos se queda con lo esencial (como .t .sub en ui/Table.svelte), y un
	   nombre largo se corta con «…» para que likes y descargas no se salgan (el nombre entero, en el title). */
	@container (max-width: 390px) {
		.wide {
			display: none;
		}

		.mname {
			max-width: 45cqi;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}
</style>

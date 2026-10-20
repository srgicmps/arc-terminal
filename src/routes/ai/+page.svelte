<script lang="ts">
	import { resolve } from '$app/paths';
	import HnTable from '#lib/components/HnTable.svelte';
	import NewsList from '#lib/components/NewsList.svelte';
	import PaperList from '#lib/components/PaperList.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import QuoteBoard from '#lib/components/QuoteBoard.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Bar from '#lib/components/ui/Bar.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { flopPct, flops } from '#lib/epoch.ts';
	import { compact, dm, nf, period } from '#lib/format.ts';
	import { hnByTopic } from '#lib/hn.ts';
	import { BIG_TECH } from '#lib/tickers/bigtech.ts';
	import { AI_CHAIN } from '#lib/tickers/aichain.ts';
	import { quotesHeight } from '#lib/tickers.ts';
	import TvWidget from '#lib/components/TvWidget.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Cesta de la cadena de la IA: el widget pone los eslabones uno debajo de otro, cada uno con su título, así
	// que el alto cuenta todos los valores y un título por eslabón (como una fila más).
	const chain = {
		showSymbolLogo: false,
		symbolsGroups: AI_CHAIN.map((link) => ({ name: link.name, symbols: link.symbols.map((s) => ({ name: s.tv, displayName: s.name })) }))
	};
	const chainHeight = quotesHeight(AI_CHAIN.reduce((n, l) => n + l.symbols.length + 1, 0));

	// De la portada de Hacker News, lo que habla de IA.
	const hnAi = $derived(hnByTopic(data.hn?.data ?? [], 'ai'));
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
		<Panel title="Titulares" meta="IA" jump={{ code: 'NEWS', href: `${resolve('/news')}?s=ai` }}>
			<NewsList items={data.news?.data.items ?? []} summaries />
			{#snippet note()}<Updated at={data.news?.fetchedAt} source="news-ai" />{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Tecnológicas en bolsa" meta="TradingView · toca un código para su ficha">
			<QuoteBoard name="Tecnológicas" codes={BIG_TECH} />
		</Panel>
		<Panel title="La cadena de la IA" meta="Chips, fabricación, memoria, servidores y energía · en directo">
			<TvWidget widget="market-quotes" config={chain} height={chainHeight} />
		</Panel>
		<Panel title="IA en Hacker News" meta="{hnAi.length} en portada">
			{#if hnAi.length}<HnTable items={hnAi} />{:else}<p class="empty">Nada de este tema en la portada ahora mismo.</p>{/if}
			{#snippet note()}Fuente: Hacker News (API de Algolia) · <Updated at={data.hn?.fetchedAt} source="hn" />{/snippet}
		</Panel>
		{#if data.newModels?.data.length}
			{@const fresh = data.newModels.data}
			<Panel title="Modelos nuevos del mes" meta="Precio en $ por millón de tokens · OpenRouter">
				<Table>
					<thead><tr><th>Modelo</th><th>Día</th><th>Contexto</th><th>Entrada</th><th>Salida</th></tr></thead>
					<tbody>
						{#each fresh as m (m.id)}
							<tr>
								<td class="name mname" title={m.id}
									><a class="model" href={m.url} target="_blank" rel="noopener">{m.name}</a><span class="sub">{m.lab}</span></td
								>
								<td class="mut">{dm(`${m.date}T12:00:00Z`)}</td>
								<td class="mut">{m.context ? compact(m.context) : '—'}</td>
								<td>{m.input === null ? '—' : m.input === 0 ? 'Gratis' : nf(m.input, 2)}</td>
								<td>{m.output === null ? '—' : m.output === 0 ? 'Gratis' : nf(m.output, 2)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					Modelos que han entrado en OpenRouter en los últimos 31 días, con su precio en esa plataforma ·
					<Updated at={data.newModels?.fetchedAt} source="aimodels" />
				{/snippet}
			</Panel>
		{/if}
		{#if data.frontier?.data.models.length}
			{@const fr = data.frontier.data}
			<Panel title="Modelos frontera" meta="Cómputo de entrenamiento estimado, en FLOP · Epoch AI">
				<Table>
					<thead><tr><th>Modelo</th><th>Fecha</th><th>Cómputo</th><th class="spark"><span class="sr">Frente al récord</span></th></tr></thead>
					<tbody>
						{#each fr.models as m (m.name + m.date)}
							<tr>
								<td class="name mname" title={m.country}
									><a class="model" href={m.url} target="_blank" rel="noopener">{m.name}</a><span class="sub">{m.org}</span></td
								>
								<td class="mut">{period(m.date.slice(0, 7))}</td>
								<td>{flops(m.flop)}</td>
								<td class="spark"><Bar pct={flopPct(m.flop, fr.record?.flop ?? null)} tone={m.flop && m.flop === fr.record?.flop ? 'amber' : 'faint'} thin /></td>
							</tr>
						{/each}
					</tbody>
				</Table>
				{#snippet note()}
					{#if fr.record}Récord: {fr.record.name} ({fr.record.org}), {flops(fr.record.flop)} FLOP · {/if}Barra en escala
					logarítmica · Datos: <a href="https://epoch.ai/data/ai-models" target="_blank" rel="noopener">Epoch AI, «Data on AI models»</a>
					(CC BY 4.0) · <Updated at={data.frontier?.fetchedAt} source="epoch" />
				{/snippet}
			</Panel>
		{/if}
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

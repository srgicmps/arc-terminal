<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { compact } from '#lib/format.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let lang = $state<'es' | 'en'>('es');
	const langs = [
		{ value: 'es', label: 'ES' },
		{ value: 'en', label: 'EN' }
	] as const;

	// La edición elegida: la española va arriba en el JSON y la inglesa en `en` (si respondió).
	const wiki = $derived(lang === 'en' && data.wiki?.data.en ? data.wiki.data.en : data.wiki?.data);
	const site = $derived(lang === 'en' ? 'en.wikipedia.org' : 'es.wikipedia.org');
</script>

<ViewHeader code="WIKI" title="Wikipedia hoy" sub="Lo más leído ayer, efemérides y artículo destacado, en español o en inglés" />

{#if data.wiki?.data.en}
	<div class="controls">
		<Seg label="Idioma" options={langs} bind:value={lang} />
	</div>
{/if}

{#if !wiki}
	<p class="empty">Sin datos todavía.</p>
{:else}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="Lo más leído" meta="Ayer, en {site}">
				<ol class="wl">
					{#each wiki.mostRead as p, i (p.url)}
						<li>
							<span class="rk">{i + 1}</span>
							<div>
								<a href={p.url} target="_blank" rel="noopener">{p.title}</a>
								{#if p.extract}<p>{p.extract}</p>{/if}
							</div>
							{#if p.views}<span class="views">{compact(p.views)}</span>{/if}
						</li>
					{/each}
				</ol>
				{#snippet note()}Fuente: Wikipedia (CC BY-SA 4.0) · <Updated at={data.wiki?.fetchedAt} source="wiki" />{/snippet}
			</Panel>
		</div>
		<div class="col">
			{#if wiki.news?.length}
				<Panel title="In the news" meta="Portada de en.wikipedia.org">
					<ul class="itn">
						{#each wiki.news as n, i (i)}
							<li>
								{#if n.url}<a href={n.url} target="_blank" rel="noopener">{n.text}</a>{:else}<span>{n.text}</span>{/if}
							</li>
						{/each}
					</ul>
				</Panel>
			{/if}
			{#if wiki.featured}
				<Panel title="Artículo destacado">
					<div class="feat">
						<a href={wiki.featured.url} target="_blank" rel="noopener">{wiki.featured.title}</a>
						<p>{wiki.featured.extract}</p>
					</div>
				</Panel>
			{/if}
			<Panel title="Tal día como hoy" meta="Efemérides">
				<ul class="otd">
					{#each wiki.onThisDay as e, i (i)}
						<li>
							<span class="year">{e.year}</span>
							{#if e.url}<a href={e.url} target="_blank" rel="noopener">{e.text}</a>{:else}<span>{e.text}</span>{/if}
						</li>
					{/each}
				</ul>
			</Panel>
		</div>
	</div>
{/if}

<style>
	.controls {
		margin-bottom: var(--sp-12);
	}

	.wl,
	.itn,
	.otd {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.wl li {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) auto;
		gap: var(--sp-10);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	.wl li:last-child,
	.itn li:last-child,
	.otd li:last-child {
		border-bottom: 0;
	}

	.rk {
		color: var(--faint);
		font-size: var(--fs-xs);
		padding-top: var(--sp-3);
	}

	.views {
		color: var(--muted);
		font-size: var(--fs-s);
		white-space: nowrap;
	}

	a {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	a:hover {
		color: var(--amber);
	}

	p {
		margin: var(--sp-3) 0 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}

	.feat {
		padding: var(--sp-10) var(--pad-x);
	}

	.otd li {
		display: grid;
		grid-template-columns: 44px minmax(0, 1fr);
		gap: var(--sp-10);
		padding: var(--sp-7) var(--pad-x);
		border-bottom: var(--border);
	}

	.itn li {
		padding: var(--sp-7) var(--pad-x);
		border-bottom: var(--border);
	}

	.itn a,
	.itn span,
	.otd a,
	.otd span {
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}

	.itn span,
	.otd span:not(.year) {
		font-family: var(--sans);
	}

	.year {
		color: var(--amber);
		font-family: var(--mono);
		font-size: var(--fs-s);
	}
</style>

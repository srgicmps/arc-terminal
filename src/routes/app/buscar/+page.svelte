<!--
	Buscar (app Sencilla): un campo normal y tres grupos de resultados: temas de la app, empresas (para seguirlas en
	«Tu dinero») y noticias. Sin códigos ni comandos.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import Icon from '#lib/components/sencillo/Icon.svelte';
	import Section from '#lib/components/sencillo/Section.svelte';
	import Stories from '#lib/components/sencillo/Stories.svelte';
	import { find, TOPICS } from '#lib/sencillo/find.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { inWatchlist, toggleWatch } from '#lib/watchlist.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let q = $state('');
	const topics = $derived(find(q, TOPICS, (t) => `${t.label} ${t.words}`, 5));
	const companies = $derived(find(q, TICKERS, (t) => `${t.name} ${t.code} ${(t.aliases ?? []).join(' ')}`, 6));
	const news = $derived(q.trim().length >= 3 ? find(q, data.stories, (s) => `${s.title} ${s.source}`, 10) : []);
</script>

<svelte:head>
	<title>Arc · Buscar</title>
</svelte:head>

<h1>Buscar</h1>

<label class="field">
	<Icon name="search" />
	<!-- svelte-ignore a11y_autofocus -->
	<input type="search" bind:value={q} placeholder="Hipoteca, gasolina, Apple, Ucrania…" aria-label="Buscar" autofocus enterkeyhint="search" />
</label>

<div class="stack">
	{#if topics.length}
		<Section title="En Arc">
			<ul class="list">
				{#each topics as t (t.label)}
					<li><a href={resolve(t.route)}>{t.label}<Icon name="chevron" /></a></li>
				{/each}
			</ul>
		</Section>
	{/if}
	{#if companies.length}
		<Section title="Empresas">
			<ul class="list">
				{#each companies as t (t.code)}
					<li>
						<span>{t.name}</span>
						<button type="button" aria-pressed={inWatchlist(t.code)} onclick={() => toggleWatch(t.code)}>{inWatchlist(t.code) ? 'Siguiendo' : '+ Seguir'}</button>
					</li>
				{/each}
			</ul>
			<a class="more" href={resolve('/app/dinero')}>Ver tus valores</a>
		</Section>
	{/if}
	{#if news.length}
		<Section title="Noticias">
			<Stories stories={news} />
		</Section>
	{/if}
	{#if q.trim() && !topics.length && !companies.length && !news.length}
		<p class="mut">No hay nada con «{q.trim()}». Prueba con otra palabra.</p>
	{:else if !q.trim()}
		<p class="mut">Escribe lo que buscas, con tus palabras.</p>
	{/if}
</div>

<style>
	h1 {
		margin: 0 0 var(--sp-12);
		font-size: var(--app-fs-h1);
	}

	.field {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		min-height: calc(var(--touch) + var(--sp-4));
		padding: 0 var(--sp-14);
		margin-bottom: var(--sp-16);
		border: var(--border);
		border-radius: var(--app-radius-s);
		background: var(--panel);
		color: var(--muted);
		max-width: var(--app-max);
	}

	input {
		flex: 1;
		min-width: 0;
		border: 0;
		outline: 0;
		background: none;
		color: var(--fg);
		font: inherit;
		font-size: var(--app-fs-body);
	}

	.field:focus-within {
		border-color: var(--amber-edge);
	}

	.stack {
		display: grid;
		gap: var(--sp-16);
		max-width: var(--app-max);
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-8);
		min-height: var(--touch);
	}

	.list li + li {
		border-top: var(--border);
	}

	.list a {
		display: flex;
		flex: 1;
		align-items: center;
		justify-content: space-between;
		min-height: var(--touch);
		color: var(--fg);
		text-decoration: none;
	}

	.list button {
		min-height: var(--touch);
		padding: 0 var(--sp-14);
		border: var(--border);
		border-radius: var(--app-radius-pill);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
		font-size: var(--app-fs-small);
		cursor: pointer;
	}

	.list button[aria-pressed='true'] {
		color: var(--amber);
	}

	.more {
		color: var(--amber);
		font-size: var(--app-fs-small);
	}

	.mut {
		color: var(--muted);
		margin: 0;
	}
</style>

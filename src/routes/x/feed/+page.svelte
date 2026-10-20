<!--
	Experiencia «Feed»: todo lo que pasa como una línea de tiempo vertical, del más reciente al más antiguo y por
	días. Filtros por tema y «Solo lo mío» (tus valores de MIS, tus palabras vigiladas de BOE y tus países de PAIS),
	que se recuerdan en este navegador. Lógica en src/lib/exp/feed.ts.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import { COUNTRIES, countryNames } from '#lib/countries.ts';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { dayLabel, filterFeed, TOPICS, type FeedItem } from '#lib/exp/feed.ts';
	import { favCountries, initFavCountries } from '#lib/favcountries.svelte.ts';
	import { hm } from '#lib/format.ts';
	import { names } from '#lib/news.ts';
	import { persisted } from '#lib/persisted.svelte.ts';
	import { TICKERS } from '#lib/tickers.ts';
	import { langOf, shown } from '#lib/titles.svelte.ts';
	import { watchlist } from '#lib/watchlist.svelte.ts';
	import { initWatchwords, watchwords } from '#lib/watchwords.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exp = EXPERIENCES.find((e) => e.id === 'feed')!;
	const href = (path: string) => (resolve as (r: string) => string)(path);
	const KIND: Record<FeedItem['kind'], string> = { imp: 'Importante', news: 'Titular', release: 'Dato publicado', quake: 'Aviso', move: 'Mercado', record: 'Récord' };
	const LABEL = Object.fromEntries(TOPICS.map((t) => [t.value, t.label]));

	$effect(initWatchwords);
	$effect(initFavCountries);

	// Filtros recordados en este navegador: los temas, separados por comas, y «solo lo mío».
	const VALID = new Set<string>(TOPICS.map((t) => t.value));
	const savedTopics = persisted<string>('arc-feed-topics', '', (v) => v === '' || v.split(',').every((t) => VALID.has(t)));
	const savedMine = persisted<'0' | '1'>('arc-feed-mine', '0', (v) => v === '0' || v === '1');
	const topics = $derived(savedTopics.value ? savedTopics.value.split(',') : []);
	const mine = $derived(savedMine.value === '1');

	const words = $derived([
		...TICKERS.filter((t) => watchlist.codes.includes(t.code)).flatMap((t) => names(t)),
		...watchwords.words,
		...COUNTRIES.filter((c) => favCountries.codes.includes(c.code)).flatMap((c) => countryNames(c))
	]);

	const items = $derived(filterFeed(data.items as FeedItem[], topics, mine, words));
	const now = $derived(clock.now || (data.fetchedAt ? Date.parse(data.fetchedAt) : 0));
	const days = $derived.by(() => {
		const out: { label: string; items: FeedItem[] }[] = [];
		for (const i of items) {
			const label = dayLabel(i.t, now);
			if (out.at(-1)?.label === label) out.at(-1)!.items.push(i);
			else out.push({ label, items: [i] });
		}
		return out;
	});
</script>

<ExpHeader {exp} sub="Todo lo que pasa, del más reciente al más antiguo" />

<div class="filters">
	<Seg label="Temas" options={TOPICS} bind:values={() => topics, (v) => (savedTopics.value = v.join(','))} />
	<label class="mine">
		<input type="checkbox" checked={mine} onchange={(e) => (savedMine.value = e.currentTarget.checked ? '1' : '0')} />
		Solo lo mío
	</label>
</div>
{#if mine && !words.length}
	<p class="hint">
		«Lo tuyo» sale de tus valores (<a href={href('/mis')}>MIS</a>), tus palabras vigiladas (<a href={href('/boe')}>BOE</a>) y tus países
		(<a href={href('/pais')}>PAIS</a>). Todavía no tienes ninguno.
	</p>
{/if}

<ol class="feed">
	{#each days as d (d.label)}
		<li class="day"><h2>{d.label}</h2></li>
		{#each d.items as i (i.id)}
			<li class="ev {i.kind}">
				<span class="dot" aria-hidden="true"></span>
				<div class="body">
					<p class="meta">
						<time datetime={i.t}>{hm(i.t)}</time>
						<span class="kind">{KIND[i.kind]}</span>
						<span>{LABEL[i.topic]}</span>
						<span class="src">{i.source}</span>
					</p>
					{#if i.url}
						<a class="title" href={i.url} rel="noopener" target="_blank" lang={langOf(i)}>{shown(i).text}</a>
					{:else}
						<span class="title" lang={i.lang}>{i.title}</span>
					{/if}
					{#if i.detail}<p class="detail">{i.detail}</p>{/if}
					{#if i.view}<a class="more" href={href(i.view)}>Seguir en Arc ›</a>{/if}
				</div>
			</li>
		{/each}
	{:else}
		<li class="empty">Nada con estos filtros.</li>
	{/each}
</ol>

<style>
	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8) var(--sp-16);
		margin-bottom: var(--sp-12);
	}

	.mine {
		display: inline-flex;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--control-h);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.mine input {
		accent-color: var(--amber);
	}

	.hint {
		margin: 0 0 var(--sp-12);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.hint a {
		color: var(--amber);
	}

	.feed {
		list-style: none;
		margin: 0 auto;
		padding: 0;
		max-width: 760px;
	}

	.day h2 {
		margin: var(--sp-16) 0 var(--sp-8);
		font-family: var(--mono);
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
	}

	.day h2::first-letter {
		text-transform: uppercase;
	}

	.ev {
		position: relative;
		display: grid;
		grid-template-columns: var(--sp-24) minmax(0, 1fr);
	}

	/* La línea de tiempo: un hilo vertical y un punto por suceso. */
	.ev::before {
		content: '';
		position: absolute;
		left: calc(var(--sp-12) - var(--hair) / 2);
		top: 0;
		bottom: 0;
		border-left: var(--hair) solid var(--line);
	}

	.dot {
		position: relative;
		width: var(--sp-8);
		height: var(--sp-8);
		margin: var(--sp-14) 0 0 var(--sp-8);
		border-radius: 50%;
		background: var(--bg);
		border: var(--hair) solid var(--muted);
	}

	.imp .dot,
	.record .dot {
		background: var(--amber);
		border-color: var(--amber);
	}

	.quake .dot {
		border-color: var(--amber);
	}

	.body {
		display: grid;
		gap: var(--sp-2);
		margin-bottom: var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
		background: var(--panel);
		border: var(--border);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--sp-8);
		margin: 0;
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--faint);
		text-transform: uppercase;
	}

	.meta time {
		color: var(--muted);
	}

	.imp .kind,
	.record .kind {
		color: var(--amber);
	}

	.src {
		text-transform: none;
	}

	.title {
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-snug);
		color: var(--fg);
		text-decoration: none;
	}

	.imp .title {
		font-weight: var(--fw-medium);
	}

	a.title:hover,
	a.title:focus-visible {
		text-decoration: underline;
		text-decoration-thickness: var(--hair);
	}

	.detail {
		margin: 0;
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.more {
		justify-self: start;
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--muted);
		text-decoration: none;
	}

	.more:hover {
		color: var(--amber);
	}

	:global(:root[data-modo='sencillo']) .title {
		font-size: var(--fs-xl);
	}
</style>

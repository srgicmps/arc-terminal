<!--
	Experiencia «Zen»: una sola cosa cada vez (una noticia importante o una cifra del día), en grande y con su
	explicación sencilla. Flechas, espacio, deslizar o los botones pasan a la siguiente. Pensada para quien no
	sigue la economía a diario.
-->
<script lang="ts">
	import ExpHeader from '#lib/components/ExpHeader.svelte';
	import Listen from '#lib/components/ui/Listen.svelte';
	import { EXPERIENCES } from '#lib/experiences.ts';
	import { swipeDirection } from '#lib/swipe.ts';
	import { shown } from '#lib/titles.svelte.ts';
	import type { ZenCard } from '#lib/exp/zen.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const exp = EXPERIENCES.find((e) => e.id === 'zen')!;
	const cards = $derived(data.cards as ZenCard[]);
	let index = $state(0);
	const card = $derived(cards[Math.min(index, cards.length - 1)]);

	const go = (dir: -1 | 1) => (index = Math.max(0, Math.min(cards.length - 1, index + dir)));

	function onKey(e: KeyboardEvent) {
		const el = e.target as HTMLElement | null;
		if (e.ctrlKey || e.metaKey || e.altKey || el?.closest('input, textarea, select, [contenteditable]')) return;
		if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1);
		else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1);
		else return;
		e.preventDefault();
	}

	let touch: { x: number; y: number; t: number } | null = null;
	const onStart = (e: TouchEvent) => (touch = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() });
	function onEnd(e: TouchEvent) {
		if (!touch) return;
		const t = e.changedTouches[0];
		const dir = swipeDirection(t.clientX - touch.x, t.clientY - touch.y, Date.now() - touch.t);
		touch = null;
		if (dir) go(dir);
	}

	/** Lo que lee «Escuchar»: la tarjeta de ahora. */
	function lines() {
		if (!card) return [];
		if (card.kind === 'news') return [{ text: shown(card).text }, { text: card.term ? `${card.term.term}: ${card.term.def}` : '' }];
		const f = card.figure;
		return [{ text: `${f.label}: ${f.text.replace('%', 'por ciento')}.` }, { text: card.sentence }, { text: f.explain }];
	}
</script>

<svelte:window onkeydown={onKey} />

<ExpHeader {exp} sub="Una cosa cada vez. Flechas o deslizar para pasar.">
	{#snippet aside()}<Listen {lines} />{/snippet}
</ExpHeader>

{#if card}
	<section class="zen" ontouchstart={onStart} ontouchend={onEnd} aria-roledescription="carrusel" aria-label="Lo de hoy, una cosa cada vez">
		{#key card.key}
			<article class="card" aria-live="polite">
				{#if card.kind === 'news'}
					<p class="kind">Noticia importante · la cuentan {card.sources.length} {card.sources.length === 1 ? 'medio' : 'medios'}</p>
					<h2>{shown(card).text}</h2>
					{#if card.term}
						<p class="explain"><strong>{card.term.term}.</strong> {card.term.def}</p>
					{/if}
					<p class="more"><a href={card.url} rel="noopener" target="_blank">Leer la noticia ({card.sources[0]}) ↗</a></p>
				{:else}
					<p class="kind">Dato del día · {card.figure.source}</p>
					<h2 class="label">{card.figure.label}</h2>
					<p class="value">{card.figure.text}</p>
					<p class="sentence">{card.sentence}</p>
					<p class="explain">{card.figure.explain}</p>
				{/if}
			</article>
		{/key}

		<nav class="nav" aria-label="Pasar">
			<button type="button" onclick={() => go(-1)} disabled={index === 0} aria-label="Anterior">←</button>
			<span class="count">{index + 1} / {cards.length}</span>
			<button type="button" onclick={() => go(1)} disabled={index >= cards.length - 1} aria-label="Siguiente">→</button>
		</nav>
		<div class="dots" aria-hidden="true">
			{#each cards as c, i (c.key)}<span class:on={i === index}></span>{/each}
		</div>
	</section>
{:else}
	<p class="empty">Todavía no hay nada que enseñar.</p>
{/if}

<style>
	.zen {
		display: grid;
		justify-items: center;
		align-content: center;
		gap: var(--sp-20);
		min-height: 60vh;
		padding: var(--sp-24) var(--sp-16);
		touch-action: pan-y;
	}

	.card {
		width: min(100%, 720px);
		display: grid;
		gap: var(--sp-16);
		text-align: center;
		animation: in 0.35s ease-out;
	}

	@keyframes in {
		from {
			opacity: 0;
			transform: translateY(var(--sp-8));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.card {
			animation: none;
		}
	}

	.kind {
		margin: 0;
		font-family: var(--mono);
		font-size: var(--fs-xs);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-code);
	}

	h2 {
		margin: 0;
		font-family: var(--sans);
		font-size: clamp(var(--fs-xl), 5vw, calc(var(--fs-xxl) * 1.5));
		font-weight: var(--fw-medium);
		line-height: var(--lh-tight);
		text-wrap: balance;
	}

	h2.label {
		font-size: clamp(var(--fs-l), 3vw, var(--fs-xxl));
		color: var(--muted);
	}

	.value {
		margin: 0;
		font-family: var(--mono);
		font-size: clamp(var(--fs-xxl), 12vw, calc(var(--fs-xxl) * 3));
		line-height: 1;
	}

	.sentence {
		margin: 0;
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	.explain {
		margin: 0 auto;
		max-width: 56ch;
		font-family: var(--sans);
		font-size: var(--fs-l);
		line-height: var(--lh-loose);
		color: var(--muted);
	}

	.explain strong {
		color: var(--fg);
		font-weight: var(--fw-medium);
	}

	.more a {
		color: var(--amber);
		text-decoration: none;
	}

	.nav {
		display: flex;
		align-items: center;
		gap: var(--sp-16);
	}

	.nav button {
		min-width: var(--touch);
		height: var(--touch);
		background: var(--raise);
		border: var(--border);
		color: var(--fg);
		font: inherit;
		font-size: var(--fs-xl);
		cursor: pointer;
	}

	.nav button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.count {
		font-family: var(--mono);
		font-size: var(--fs-s);
		color: var(--muted);
	}

	.dots {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-4);
		max-width: 320px;
	}

	.dots span {
		width: var(--sp-6);
		height: var(--sp-6);
		border-radius: 50%;
		background: var(--line);
	}

	.dots span.on {
		background: var(--amber);
	}

	:global(:root[data-modo='sencillo']) .explain,
	:global(:root[data-modo='sencillo']) .sentence {
		font-size: var(--fs-xl);
	}
</style>

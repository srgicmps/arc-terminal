<!--
	Un dato de la app Sencilla como tarjeta: el nombre, la cifra grande, la flecha (verde si sube, roja si baja), la
	frase en español llano y un minigráfico. Al tocarla se abre la hoja con la explicación (explain.ts): qué es,
	por qué importa y cómo leerlo.
-->
<script lang="ts">
	import { explain } from '#lib/explain.ts';
	import type { Fact } from '#lib/sencillo/facts.ts';
	import MiniChart from './MiniChart.svelte';
	import Sheet from './Sheet.svelte';

	let { fact }: { fact: Fact } = $props();

	let open = $state(false);
	const info = $derived(explain(fact.explain));
	const dir = $derived(fact.delta === null ? 'none' : !fact.delta ? 'flat' : fact.delta > 0 ? 'up' : 'down');
	const arrow = { up: '▲', down: '▼', flat: '●', none: '' };
</script>

<button type="button" class="card" onclick={() => (open = true)} aria-haspopup="dialog">
	<span class="title">{fact.title}</span>
	<span class="num">{fact.value}</span>
	{#if fact.change}
		<span class="chg {dir}">{#if arrow[dir]}<span aria-hidden="true">{arrow[dir]}</span> {/if}{fact.change}</span>
	{/if}
	<MiniChart values={fact.spark} />
	{#if fact.phrase}<span class="phrase">{fact.phrase}</span>{/if}
	<span class="more">¿Qué significa?</span>
</button>

<Sheet bind:open title={fact.title}>
	<p class="big">{fact.value}</p>
	{#if fact.change}<p class="chg {dir}">{#if arrow[dir]}<span aria-hidden="true">{arrow[dir]}</span> {/if}{fact.change}</p>{/if}
	<MiniChart values={fact.spark} tall />
	{#if fact.phrase}<p class="lead">{fact.phrase}</p>{/if}
	{#if info}
		<h3>¿Qué es?</h3>
		<p>{info.what}</p>
		{#if info.why}
			<h3>¿Por qué importa?</h3>
			<p>{info.why}</p>
		{/if}
		{#if info.how}
			<h3>Cómo leerlo</h3>
			<p>{info.how}</p>
		{/if}
	{/if}
	<p class="src">Dato de {fact.when} · {fact.source}</p>
</Sheet>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
		width: 100%;
		padding: var(--sp-16);
		border: var(--border);
		border-radius: var(--app-radius);
		background: var(--panel);
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: transform var(--app-dur);
	}

	.card:active {
		transform: scale(0.98);
	}

	.title {
		color: var(--muted);
		font-size: var(--app-fs-small);
		font-weight: var(--fw-medium);
	}

	.num {
		font-size: var(--app-fs-num);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
		letter-spacing: var(--track-tight);
		line-height: var(--lh-tight);
	}

	.chg {
		margin: 0;
		font-size: var(--app-fs-small);
		font-weight: var(--fw-medium);
	}

	.up {
		color: var(--up);
	}

	.down {
		color: var(--down);
	}

	.flat,
	.none {
		color: var(--muted);
	}

	.phrase {
		font-size: var(--app-fs-small);
		line-height: var(--lh-text);
		color: var(--fg);
	}

	.more {
		color: var(--amber);
		font-size: var(--app-fs-small);
	}

	.big {
		margin: 0;
		font-size: var(--app-fs-hero);
		font-weight: var(--fw-bold);
		font-variant-numeric: tabular-nums;
	}

	.lead {
		font-size: var(--app-fs-body);
		line-height: var(--lh-text);
	}

	h3 {
		margin: var(--sp-16) 0 var(--sp-4);
		font-size: var(--app-fs-body);
		color: var(--amber);
	}

	p {
		margin: var(--sp-6) 0;
		font-size: var(--app-fs-body);
		line-height: var(--lh-text);
	}

	.src {
		margin-top: var(--sp-20);
		color: var(--muted);
		font-size: var(--app-fs-small);
	}
</style>

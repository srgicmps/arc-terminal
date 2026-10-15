<!-- Cabecera de cada vista: código en ámbar, título, de dónde salen los datos y, con `summary`, el resumen en una
	línea hecho con los datos (src/lib/summary.ts). -->
<script lang="ts">
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { hiddenPanels, isSimple, modo } from '#lib/modo.svelte.ts';

	interface Props {
		code: string;
		title: string;
		sub?: string;
		/** Contenido a la derecha (fecha, botones…). */
		aside?: Snippet;
		/** Resumen en una línea con los datos de la vista («Inflación euro baja al 2,1 % · …»). */
		summary?: string;
		/** Modo Sencillo: los datos clave contados en frases (src/lib/plain.ts). Ahí sustituyen al resumen. */
		plain?: string[];
	}

	let { code, title, sub, aside, summary, plain }: Props = $props();

	// Modo Sencillo: «Ver todos» vuelve a enseñar los paneles que el modo oculta en esta vista. Al cambiar de
	// vista, se vuelve a lo esencial.
	$effect(() => {
		void page.url.pathname;
		modo.all = false;
	});
</script>

<svelte:head>
	<title>{code} · Arc Terminal</title>
</svelte:head>

<div class="vh" data-ui="view-head">
	<div>
		<h1 data-ui="view-title"><span class="code" data-ui="view-code">{code}</span>{title}</h1>
		{#if sub}<p data-ui="view-sub">{sub}</p>{/if}
		{#if isSimple() && plain?.length}
			<ul class="plain" data-ui="view-sum">
				{#each plain as line (line)}<li>{line}</li>{/each}
			</ul>
		{:else if summary}<p class="sum" data-ui="view-sum">{summary}</p>{/if}
		{#if isSimple() && hiddenPanels.size}
			<p class="more">
				{modo.all ? 'Ves todos los paneles.' : `Ves lo esencial: ${hiddenPanels.size} ${hiddenPanels.size === 1 ? 'panel más' : 'paneles más'} en el modo completo.`}
				<button type="button" onclick={() => (modo.all = !modo.all)}>{modo.all ? 'Ver solo lo esencial' : 'Ver todos'}</button>
			</p>
		{/if}
	</div>
	{#if aside}<div class="vh-r">{@render aside()}</div>{/if}
</div>

<style>
	.vh {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		justify-content: space-between;
		gap: var(--sp-8) var(--sp-24);
		padding-block: var(--sp-2) var(--sp-12);
	}

	h1 {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: var(--sp-12);
		font-family: var(--sans);
		font-weight: var(--fw-medium);
		font-size: var(--fs-xl);
		text-wrap: balance;
	}

	.code {
		font-family: var(--mono);
		font-size: var(--fs-l);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-code);
		color: var(--amber);
	}

	p {
		margin: var(--sp-4) 0 0;
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	/* El resumen se lee antes que las fuentes: en el color del texto, un punto más grande. */
	.sum {
		color: var(--fg);
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
	}

	/* Modo Sencillo: los datos clave en frases, en el color del texto y con la letra de los textos. */
	.plain {
		margin: var(--sp-8) 0 0;
		padding: 0;
		list-style: none;
		display: grid;
		gap: var(--sp-4);
		max-width: 72ch;
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
		color: var(--fg);
	}

	/* Modo Sencillo: cuántos paneles quedan fuera y el botón para verlos, discreto, como un enlace. */
	.more button {
		margin-left: var(--sp-4);
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber-dim);
		font: inherit;
		text-decoration: underline;
		text-underline-offset: var(--sp-2);
		cursor: pointer;
	}

	.more button:hover {
		color: var(--amber);
	}

	.vh-r {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>

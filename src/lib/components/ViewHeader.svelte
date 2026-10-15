<!-- Cabecera de cada vista: código en ámbar, título, de dónde salen los datos y, con `summary`, el resumen en una
	línea hecho con los datos (src/lib/summary.ts). -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		code: string;
		title: string;
		sub?: string;
		/** Contenido a la derecha (fecha, botones…). */
		aside?: Snippet;
		/** Resumen en una línea con los datos de la vista («Inflación euro baja al 2,1 % · …»). */
		summary?: string;
	}

	let { code, title, sub, aside, summary }: Props = $props();
</script>

<svelte:head>
	<title>{code} · Arc Terminal</title>
</svelte:head>

<div class="vh">
	<div>
		<h1><span class="code">{code}</span>{title}</h1>
		{#if sub}<p>{sub}</p>{/if}
		{#if summary}<p class="sum">{summary}</p>{/if}
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

	.vh-r {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>

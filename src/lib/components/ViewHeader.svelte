<!-- Cabecera de cada vista: código en ámbar, título y de dónde salen los datos. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		code: string;
		title: string;
		sub?: string;
		/** Contenido a la derecha (fecha, botones…). */
		aside?: Snippet;
	}

	let { code, title, sub, aside }: Props = $props();
</script>

<svelte:head>
	<title>{code} · Arc Terminal</title>
</svelte:head>

<div class="vh">
	<div>
		<h1><span class="code">{code}</span>{title}</h1>
		{#if sub}<p>{sub}</p>{/if}
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

	.vh-r {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>

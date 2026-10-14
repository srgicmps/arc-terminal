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
	.vh-r {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>

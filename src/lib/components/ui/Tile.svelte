<!--
	Recuadro con una cifra grande: etiqueta en mayúsculas, la cifra y una línea de detalle. Va dentro de <Tiles>.
	Si el glosario (src/lib/glossary.ts) conoce la etiqueta, lleva detrás un ⓘ con la definición.
	El detalle es sub (texto) o, si hace falta marcado, lo que se ponga dentro: <Tile …><span class="lv">…</span></Tile>.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Term from './Term.svelte';

	interface Props {
		label: string;
		value: string;
		/** Color de la cifra: verde si es buena noticia, rojo si es mala, gris si no hay dato. */
		tone?: 'up' | 'down' | 'flat' | 'mut';
		sub?: string;
		children?: Snippet;
	}

	let { label, value, tone, sub, children }: Props = $props();
</script>

<div class="tile">
	<span class="lbl">{label}<Term of={label} /></span>
	<b class={tone}>{value}</b>
	{#if children}<span class="sub">{@render children()}</span>{:else if sub !== undefined}<span class="sub">{sub}</span>{/if}
</div>

<style>
	.tile {
		background: var(--panel);
		padding: var(--sp-12);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	b {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}

	.sub {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}
</style>

<!-- Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista. -->
<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		meta?: string;
		/** Enlace «CÓDIGO ›» a la vista completa. */
		jump?: { code: string; href: string };
		children: Snippet;
		/** Pie del panel (fuente, notas). */
		note?: Snippet;
	}

	let { title, meta, jump, children, note }: Props = $props();
</script>

<section class="panel">
	<header class="ph">
		<h2>{title}</h2>
		{#if meta || jump}
			<div class="ph-r">
				{#if meta}<span>{meta}</span>{/if}
				{#if jump}<a class="jump" href={jump.href}>{jump.code} ›</a>{/if}
			</div>
		{/if}
	</header>
	{@render children()}
	{#if note}
		<p class="pnote">{@render note()}</p>
	{/if}
</section>

<style>
	.jump {
		color: var(--muted);
		text-decoration: none;
		font-size: var(--fs-xs);
		letter-spacing: 0.06em;
	}

	.jump:hover {
		color: var(--amber);
	}

	/* En pantallas táctiles el enlace gana 44 px de alto pulsable; el margen negativo evita que la cabecera crezca. */
	@media (pointer: coarse) {
		.jump {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
			padding-inline: 12px;
			margin: -14px -12px;
		}
	}
</style>

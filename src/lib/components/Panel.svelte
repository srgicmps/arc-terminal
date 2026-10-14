<!-- Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Note from './ui/Note.svelte';

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
		<Note>{@render note()}</Note>
	{/if}
</section>

<style>
	/* container-type: lo de dentro se adapta al ancho del panel con @container, no al de la pantalla. */
	.panel {
		background: var(--panel);
		min-width: 0;
		container-type: inline-size;
	}

	.ph {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-6) var(--sp-12);
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	h2 {
		margin: 0;
		font-size: var(--fs-xs);
		font-weight: var(--fw-bold);
		letter-spacing: var(--track-label);
		text-transform: uppercase;
		color: var(--amber);
	}

	.ph-r {
		display: flex;
		align-items: center;
		gap: var(--sp-12);
		font-size: var(--fs-xs);
		color: var(--faint);
	}

	.jump {
		color: var(--muted);
		text-decoration: none;
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
	}

	.jump:hover {
		color: var(--amber);
	}

	/* En pantallas táctiles el enlace gana 44 px de alto pulsable; el margen negativo evita que la cabecera crezca. */
	@media (pointer: coarse) {
		.jump {
			display: inline-flex;
			align-items: center;
			min-height: var(--touch);
			padding-inline: var(--pad-x);
			margin: calc(-1 * var(--sp-14)) calc(-1 * var(--pad-x));
		}
	}
</style>

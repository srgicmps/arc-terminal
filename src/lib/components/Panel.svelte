<!-- Panel de la maqueta: cabecera ámbar con título, dato a la derecha y enlace opcional a otra vista. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { ShareSource } from '#lib/share.ts';
	import Note from './ui/Note.svelte';
	import Share from './ui/Share.svelte';

	interface Props {
		title: string;
		meta?: string;
		/** El dato de la derecha va en ámbar: algo que merece atención (p. ej. «5 nuevas hoy»). */
		accent?: boolean;
		/** Enlace «CÓDIGO ›» a la vista completa. */
		jump?: { code: string; href: string };
		/** Botón «Compartir»: los datos, o una función que los da al pulsar. Sin `url`, la página actual. */
		share?: ShareSource;
		children: Snippet;
		/** Pie del panel (fuente, notas). */
		note?: Snippet;
	}

	let { title, meta, accent, jump, share, children, note }: Props = $props();
</script>

<section class="panel">
	<header class="ph">
		<h2>{title}</h2>
		{#if meta || jump || share}
			<div class="ph-r">
				{#if meta}<span class:accent>{meta}</span>{/if}
				{#if share}<Share source={share} />{/if}
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

	.accent {
		color: var(--amber);
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

	/* En «encajar en pantalla» el panel hace scroll por dentro: la cabecera se queda arriba. */
	:global(html[data-fit]) .ph {
		position: sticky;
		top: 0;
		z-index: 1;
		background: var(--panel);
	}
</style>

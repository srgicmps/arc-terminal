<!-- Sección de la app Sencilla: un título grande con icono, el contenido y, si se pasa `href`, «Ver más». -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Icon, { type IconName } from './Icon.svelte';

	let { title, icon, href, more = 'Ver más', card = true, children }: { title: string; icon?: IconName; href?: string; more?: string; card?: boolean; children: Snippet } =
		$props();
</script>

<section class:card>
	<header>
		<h2>{#if icon}<Icon name={icon} />{/if}{title}</h2>
		{#if href}<a {href}>{more}<Icon name="chevron" size="var(--fs-l)" /></a>{/if}
	</header>
	{@render children()}
</section>

<style>
	section {
		display: grid;
		gap: var(--sp-10);
		min-width: 0;
	}

	.card {
		padding: var(--sp-16) var(--sp-16) var(--sp-12);
		border: var(--border);
		border-radius: var(--app-radius);
		background: var(--panel);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-12);
	}

	h2 {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		margin: 0;
		font-size: var(--app-fs-h2);
		font-weight: var(--fw-bold);
	}

	h2 :global(.icon) {
		color: var(--amber);
	}

	a {
		display: inline-flex;
		align-items: center;
		min-height: var(--touch);
		color: var(--amber);
		font-size: var(--app-fs-small);
		text-decoration: none;
	}
</style>

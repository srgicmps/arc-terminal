<svelte:head>
	<title>Arc Terminal</title>
</svelte:head>

<main class="app">
	<header class="top">
		<h1 class="brand">
			<svg class="mark" viewBox="0 0 22 22" width="22" height="22" aria-hidden="true">
				<path d="M4 16a7 7 0 0 1 14 0" />
				<path d="M8 16a3 3 0 0 1 6 0" />
			</svg>
			<span>Arc <span class="brand-sub">Terminal</span></span>
		</h1>
	</header>

	<p class="note">En construcción · fase 1: esqueleto publicado</p>
</main>

<style>
	/* Estos estilos solo afectan a este componente (Svelte los aísla, como <style scoped> en Vue). */
	.app {
		max-width: 1600px;
		margin-inline: auto;
	}

	.top {
		display: flex;
		align-items: center;
		padding-block: 4px 10px;
		border-bottom: 1px solid var(--line);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		margin: 0;
		font-size: var(--fs-s);
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}

	.mark {
		display: block;
		width: 22px;
		height: 22px;
		fill: none;
		stroke: var(--amber);
		stroke-width: 2;
		stroke-linecap: round;
	}

	.brand-sub {
		color: var(--muted);
		font-weight: 400;
	}

	.note {
		margin: 12px 0 0;
		font-family: var(--sans);
		font-size: var(--fs-m);
		color: var(--faint);
	}
</style>

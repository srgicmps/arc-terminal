<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Arc Terminal</title>
</svelte:head>

<p class="note">
	En construcción. Ya funciona <a href={resolve('/fuel')}>FUEL</a>: las gasolineras más baratas de
	Menorca.
</p>

<style>
	.note {
		margin: 4px 0 0;
		font-family: var(--sans);
		font-size: var(--fs-m);
		color: var(--faint);
	}

	.note a {
		color: var(--amber);
	}
</style>

<!--
	Cronómetro con vueltas. El estado vive en timers.svelte.ts: sigue contando al cambiar de pestaña o cerrar la
	ventana. Aquí solo se repinta (cada 50 ms mientras se ve).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { stopwatchText } from './alarms.ts';
	import { sw, swElapsed, swLap, swReset, swStart, swStop } from './timers.svelte.ts';

	let now = $state(Date.now());
	onMount(() => {
		const id = setInterval(() => (now = Date.now()), 50);
		return () => clearInterval(id);
	});
	const elapsed = $derived(swElapsed(Math.max(now, sw.since ?? 0)));
</script>

<div class="sw">
	<p class="big">{stopwatchText(elapsed)}</p>
	<div class="btns">
		{#if sw.since === null}
			<button type="button" class="go" onclick={swStart}>{elapsed ? 'Seguir' : 'Empezar'}</button>
			<button type="button" onclick={swReset} disabled={!elapsed}>Poner a cero</button>
		{:else}
			<button type="button" onclick={swStop}>Parar</button>
			<button type="button" onclick={swLap}>Vuelta</button>
		{/if}
	</div>
	{#if sw.laps.length}
		<ol>
			{#each sw.laps as l, i (i)}
				<li><span class="mut">Vuelta {sw.laps.length - i}</span><span>+{stopwatchText(l - (sw.laps[i + 1] ?? 0))}</span><b>{stopwatchText(l)}</b></li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.sw {
		display: grid;
		gap: var(--sp-12);
		justify-items: center;
	}

	.big {
		margin: var(--sp-12) 0 0;
		font-size: var(--fs-xxl);
		font-variant-numeric: tabular-nums;
	}

	.btns {
		display: flex;
		gap: var(--sp-8);
	}

	button {
		min-width: 120px;
		height: var(--control-h);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.go {
		background: var(--amber);
		color: var(--on-amber);
	}

	ol {
		width: 100%;
		max-width: 420px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--sp-12);
		padding: var(--row-y) 0;
		border-bottom: var(--border);
		font-variant-numeric: tabular-nums;
	}

	.mut {
		color: var(--muted);
	}

	b {
		font-weight: var(--fw-medium);
	}
</style>

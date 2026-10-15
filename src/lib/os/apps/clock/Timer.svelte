<!--
	Temporizador: minutos (y segundos) hacia atrás; al acabar, pitido y aviso. El estado vive en timers.svelte.ts:
	sigue aunque cambies de pestaña o cierres la ventana. Aquí solo se repinta.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { stopwatchText } from './alarms.ts';
	import { timer, timerCancel, timerStart } from './timers.svelte.ts';

	let now = $state(Date.now());
	onMount(() => {
		const id = setInterval(() => (now = Date.now()), 200);
		return () => clearInterval(id);
	});
	const left = $derived(timer.end === null ? 0 : Math.max(0, timer.end - now));
	const PRESETS = [1, 3, 5, 10, 15, 25];
	function start() {
		now = Date.now();
		timerStart();
	}
</script>

<div class="timer">
	{#if timer.end === null}
		<div class="set">
			<label>Min<input type="number" min="0" max="999" inputmode="numeric" bind:value={timer.min} /></label>
			<label>Seg<input type="number" min="0" max="59" inputmode="numeric" bind:value={timer.sec} /></label>
		</div>
		<div class="presets">
			{#each PRESETS as p (p)}<button type="button" onclick={() => ((timer.min = p), (timer.sec = 0))}>{p} min</button>{/each}
		</div>
		<button type="button" class="go" onclick={start}>Empezar</button>
	{:else}
		<p class="big">{stopwatchText(left + 999, false)}</p>
		<button type="button" onclick={timerCancel}>Cancelar</button>
	{/if}
	<p class="mut">Sigue contando aunque cierres esta ventana (no si recargas la página).</p>
</div>

<style>
	.timer {
		display: grid;
		gap: var(--sp-12);
		justify-items: center;
		padding-top: var(--sp-12);
	}

	.set,
	.presets {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: var(--sp-8);
	}

	label {
		display: grid;
		gap: var(--sp-4);
		color: var(--muted);
		font-size: var(--fs-s);
	}

	input {
		width: 90px;
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-xl);
		color: var(--fg);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
	}

	button {
		min-width: 64px;
		height: var(--control-h);
		padding: 0 var(--sp-10);
		font: inherit;
		color: var(--fg);
		background: var(--raise);
		border: var(--border);
		border-radius: var(--radius-s);
		cursor: pointer;
	}

	.go {
		min-width: 160px;
		background: var(--amber);
		color: var(--on-amber);
	}

	.big {
		margin: 0;
		font-size: var(--fs-xxl);
		font-variant-numeric: tabular-nums;
	}

	.mut {
		margin: 0;
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}
</style>

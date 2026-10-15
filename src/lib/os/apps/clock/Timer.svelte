<!-- Temporizador: minutos (y segundos) hacia atrás; al acabar, pitido y aviso. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { os } from '../../os.svelte.ts';
	import { stopwatchText } from './alarms.ts';
	import { beep, notifySystem } from './alarms.svelte.ts';

	let min = $state(5);
	let sec = $state(0);
	let end = $state<number | null>(null);
	let left = $state(0);
	let id: ReturnType<typeof setInterval> | undefined;

	function start() {
		const total = (min * 60 + sec) * 1000;
		if (total <= 0) return;
		end = Date.now() + total;
		left = total;
		id = setInterval(tick, 200);
	}
	function tick() {
		if (end === null) return;
		left = end - Date.now();
		if (left > 0) return;
		cancel();
		const text = '⏲ Temporizador terminado';
		os.notice = { text, at: Date.now() };
		beep();
		notifySystem(text);
	}
	function cancel() {
		clearInterval(id);
		end = null;
		left = 0;
	}
	onDestroy(() => clearInterval(id));
	const PRESETS = [1, 3, 5, 10, 15, 25];
</script>

<div class="timer">
	{#if end === null}
		<div class="set">
			<label>Min<input type="number" min="0" max="999" bind:value={min} /></label>
			<label>Seg<input type="number" min="0" max="59" bind:value={sec} /></label>
		</div>
		<div class="presets">
			{#each PRESETS as p (p)}<button type="button" onclick={() => ((min = p), (sec = 0))}>{p} min</button>{/each}
		</div>
		<button type="button" class="go" onclick={start}>Empezar</button>
	{:else}
		<p class="big">{stopwatchText(left + 999, false)}</p>
		<button type="button" onclick={cancel}>Cancelar</button>
	{/if}
	<p class="mut">Si cierras esta ventana, el temporizador se cancela.</p>
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

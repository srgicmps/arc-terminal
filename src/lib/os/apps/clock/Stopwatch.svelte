<!-- Cronómetro con vueltas. Cuenta con la hora del sistema (Date.now), así no se desvía aunque la pestaña duerma. -->
<script lang="ts">
	import { onDestroy } from 'svelte';
	import { stopwatchText } from './alarms.ts';

	let base = $state(0); // ms acumulados antes del último «Seguir»
	let since = $state<number | null>(null);
	let now = $state(Date.now());
	let laps = $state<number[]>([]);
	let id: ReturnType<typeof setInterval> | undefined;

	const elapsed = $derived(base + (since === null ? 0 : now - since));

	function start() {
		since = Date.now();
		id = setInterval(() => (now = Date.now()), 50);
	}
	function stop() {
		base = elapsed;
		since = null;
		clearInterval(id);
	}
	function reset() {
		stop();
		base = 0;
		laps = [];
	}
	onDestroy(() => clearInterval(id));
</script>

<div class="sw">
	<p class="big">{stopwatchText(elapsed)}</p>
	<div class="btns">
		{#if since === null}
			<button type="button" class="go" onclick={start}>{elapsed ? 'Seguir' : 'Empezar'}</button>
			<button type="button" onclick={reset} disabled={!elapsed}>Poner a cero</button>
		{:else}
			<button type="button" onclick={stop}>Parar</button>
			<button type="button" onclick={() => (laps = [elapsed, ...laps])}>Vuelta</button>
		{/if}
	</div>
	{#if laps.length}
		<ol>
			{#each laps as l, i (i)}
				<li><span class="mut">Vuelta {laps.length - i}</span><span>+{stopwatchText(l - (laps[i + 1] ?? 0))}</span><b>{stopwatchText(l)}</b></li>
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

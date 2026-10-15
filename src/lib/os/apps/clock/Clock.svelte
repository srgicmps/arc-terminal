<!-- Reloj de Arc OS: hora en varias ciudades, alarmas (en la cuenta), cronómetro con vueltas y temporizador. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import Seg from '../../../components/ui/Seg.svelte';
	import Tool from '../kit/Tool.svelte';
	import Alarms from './Alarms.svelte';
	import Stopwatch from './Stopwatch.svelte';
	import Timer from './Timer.svelte';
	import { startAlarms } from './alarms.svelte.ts';
	import type { AppProps } from '../../apps.ts';

	let { win }: AppProps = $props();

	let tab = $state<'world' | 'alarm' | 'sw' | 'timer'>('world');
	const TABS = [
		{ value: 'world', label: 'Reloj' },
		{ value: 'alarm', label: 'Alarmas' },
		{ value: 'sw', label: 'Cronómetro' },
		{ value: 'timer', label: 'Temporizador' }
	] as const;

	const CITIES = [
		['Nueva York', 'America/New_York'],
		['Londres', 'Europe/London'],
		['Fráncfort', 'Europe/Berlin'],
		['Dubái', 'Asia/Dubai'],
		['Hong Kong', 'Asia/Hong_Kong'],
		['Tokio', 'Asia/Tokyo'],
		['Sídney', 'Australia/Sydney']
	] as const;

	let now = $state(new Date());
	onMount(() => {
		startAlarms();
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const fmt = (tz?: string, sec = false) =>
		now.toLocaleTimeString('es-ES', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: sec ? '2-digit' : undefined });
	const dayOf = (tz?: string) => now.toLocaleDateString('es-ES', { timeZone: tz, weekday: 'short' });
	const today = $derived(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
</script>

<Tool {win}>
	{#snippet bar()}<Seg label="Reloj" options={TABS} bind:value={tab} />{/snippet}
	{#if tab === 'world'}
		<div class="world">
			<p class="big">{fmt(undefined, true)}</p>
			<p class="mut">{today}</p>
			<ul>
				{#each CITIES as [name, tz] (tz)}
					<li><span>{name}</span><span class="mut">{dayOf(tz)}</span><b>{fmt(tz)}</b></li>
				{/each}
			</ul>
		</div>
	{:else if tab === 'alarm'}
		<Alarms {now} />
	{:else if tab === 'sw'}
		<Stopwatch />
	{:else}
		<Timer />
	{/if}
</Tool>

<style>
	.world {
		display: grid;
		gap: var(--sp-8);
		max-width: 420px;
	}

	.big {
		margin: 0;
		font-size: var(--fs-xxl);
		color: var(--amber);
		font-variant-numeric: tabular-nums;
	}

	p {
		margin: 0;
	}

	.mut {
		color: var(--muted);
	}

	ul {
		margin: var(--sp-8) 0 0;
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

	b {
		font-weight: var(--fw-medium);
	}
</style>

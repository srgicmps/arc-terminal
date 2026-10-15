<!-- Alarmas: añadir (hora, nombre y días), encender, apagar y quitar. Se guardan en la cuenta. -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { DAY_NAMES, MAX_ALARMS, minutesUntil, untilText } from './alarms.ts';
	import { addAlarm, alarms, beep, removeAlarm, toggleAlarm } from './alarms.svelte.ts';

	let { now }: { now: Date } = $props();

	let time = $state('07:30');
	let label = $state('');
	let days = $state<number[]>([]);
	let perm = $state<NotificationPermission | 'none'>('none');
	onMount(() => (perm = 'Notification' in window ? Notification.permission : 'none'));

	const toggleDay = (d: number) => (days = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort());
	function add(e: SubmitEvent) {
		e.preventDefault();
		if (!/^\d{2}:\d{2}$/.test(time)) return;
		addAlarm(time, label.trim(), days);
		label = '';
		days = [];
	}
	async function ask() {
		perm = await Notification.requestPermission();
	}
	const daysText = (d: number[]) => (!d.length ? 'Una vez' : d.length === 7 ? 'Todos los días' : [1, 2, 3, 4, 5, 6, 0].filter((x) => d.includes(x)).map((x) => DAY_NAMES[x]).join(' '));
</script>

<div class="alarms">
	<form onsubmit={add}>
		<input type="time" bind:value={time} aria-label="Hora" required />
		<input bind:value={label} placeholder="Nombre (opcional)" maxlength="60" aria-label="Nombre" />
		<span class="days" role="group" aria-label="Días">
			{#each [1, 2, 3, 4, 5, 6, 0] as d (d)}
				<button type="button" aria-pressed={days.includes(d)} onclick={() => toggleDay(d)}>{DAY_NAMES[d]}</button>
			{/each}
		</span>
		<button type="submit" disabled={alarms.list.length >= MAX_ALARMS}>Añadir</button>
	</form>
	{#if alarms.list.length}
		<ul>
			{#each alarms.list as a (a.id)}
				{@const left = minutesUntil(a, now)}
				<li class:off={!a.on}>
					<b>{a.time}</b>
					<span>{a.label || 'Alarma'} <span class="mut">· {daysText(a.days)}{left !== null ? ` · ${untilText(left)}` : ''}</span></span>
					<button type="button" role="switch" aria-checked={a.on} onclick={() => toggleAlarm(a.id)}>{a.on ? 'Encendida' : 'Apagada'}</button>
					<button type="button" onclick={() => removeAlarm(a.id)} aria-label="Quitar la alarma de las {a.time}">×</button>
				</li>
			{/each}
		</ul>
	{:else}
		<p class="mut">Sin alarmas.</p>
	{/if}
	<p class="mut note">
		Suenan mientras Arc OS esté abierto en algún dispositivo. <button type="button" class="link" onclick={() => beep(1)}>Probar el sonido</button>
		{#if perm === 'default'}· <button type="button" class="link" onclick={ask}>Permitir avisos del sistema</button>{/if}
	</p>
</div>

<style>
	.alarms {
		display: grid;
		gap: var(--sp-12);
	}

	form {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
	}

	input,
	button {
		height: var(--control-h);
		padding: 0 var(--sp-8);
		font: inherit;
		font-size: var(--fs-field);
		color: var(--fg);
		background: var(--bg);
		border: var(--border);
		border-radius: var(--radius-s);
	}

	button {
		cursor: pointer;
		background: var(--raise);
	}

	.days {
		display: flex;
		gap: var(--sp-2);
	}

	.days button {
		width: var(--control-h);
		padding: 0;
	}

	[aria-pressed='true'],
	[aria-checked='true'] {
		color: var(--amber);
		border-color: var(--amber-dim);
		background: var(--amber-soft);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: var(--sp-8);
		padding: var(--row-y) 0;
		border-bottom: var(--border);
	}

	li b {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
		font-variant-numeric: tabular-nums;
	}

	.off b,
	.off > span {
		color: var(--faint);
	}

	.mut {
		color: var(--muted);
	}

	p {
		margin: 0;
	}

	.note {
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.link {
		display: inline-flex;
		align-items: center;
		height: auto;
		min-height: var(--control-h);
		padding: 0;
		border: 0;
		background: none;
		color: var(--amber);
		font-size: inherit;
		text-decoration: underline;
	}
</style>

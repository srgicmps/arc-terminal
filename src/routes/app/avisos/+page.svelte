<!--
	Avisos (app Sencilla): los avisos al móvil de tu cuenta, con interruptores (los mismos de AVISOS, /api/alerts),
	y los avisos del tiempo en vigor. Lo fino (nivel, tope, silencio, valores) sigue en la vista completa.
-->
<script lang="ts">
	import { resolve } from '$app/paths';
	import { BRIEF_HOURS, GROUPS, type GroupId } from '#lib/alertconfig.ts';
	import AlertsSummary from '#lib/components/sencillo/AlertsSummary.svelte';
	import Section from '#lib/components/sencillo/Section.svelte';
	import { place } from '#lib/place.svelte.ts';
	import { alerts, loadAlerts, saveAlerts } from '#lib/sencillo/alerts.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	$effect(loadAlerts);

	const c = $derived(alerts.config);
	const toggleGroup = (id: GroupId) =>
		saveAlerts({ groups: c.groups.includes(id) ? c.groups.filter((g) => g !== id) : [...c.groups, id] });
	const toggleBrief = () =>
		saveAlerts({ brief: { ...c.brief, on: !c.brief.on, place: c.brief.place ?? { name: place.current.name, lat: place.current.lat, lon: place.current.lon } } });
</script>

<svelte:head>
	<title>Arc · Avisos</title>
</svelte:head>

<h1>Avisos</h1>

<div class="stack">
	<Section title="El tiempo" icon="sun">
		<AlertsSummary weather={data.weather} />
	</Section>

	<Section title="Al móvil" icon="bell">
		{#if alerts.phase === 'ready'}
			<label class="row main">
				<span>Recibir avisos en el móvil</span>
				<input type="checkbox" role="switch" checked={c.on} disabled={alerts.saving} onchange={() => saveAlerts({ on: !c.on })} />
			</label>
			{#if c.on}
				<p class="hint">¿De qué quieres enterarte?</p>
				{#each GROUPS as g (g.id)}
					<label class="row">
						<span>{g.label}</span>
						<input type="checkbox" role="switch" checked={c.groups.includes(g.id)} disabled={alerts.saving} onchange={() => toggleGroup(g.id)} />
					</label>
				{/each}
				<label class="row">
					<span>«Tu mañana»: un resumen cada día</span>
					<input type="checkbox" role="switch" checked={c.brief.on} disabled={alerts.saving} onchange={toggleBrief} />
				</label>
				{#if c.brief.on}
					<label class="row">
						<span>A qué hora</span>
						<select value={c.brief.at} disabled={alerts.saving} onchange={(e) => saveAlerts({ brief: { ...c.brief, at: e.currentTarget.value } })}>
							{#each BRIEF_HOURS as h (h)}<option value={h}>{h}</option>{/each}
						</select>
					</label>
				{/if}
			{/if}
			<p class="status" role="status">{alerts.saving ? 'Guardando…' : alerts.saved}</p>
			<a class="more" href={resolve('/avisos')}>Más opciones (cuántos al día, silencio de noche, tus valores)</a>
		{:else if alerts.phase === 'loading' || alerts.phase === 'idle'}
			<p class="hint">Cargando…</p>
		{:else if alerts.phase === 'none'}
			<p>Los avisos al móvil van con tu cuenta, en arcterminal.dev.</p>
		{:else}
			<p>No se han podido leer tus avisos. Recarga la página.</p>
		{/if}
	</Section>
</div>

<style>
	h1 {
		margin: 0 0 var(--sp-16);
		font-size: var(--app-fs-h1);
	}

	.stack {
		display: grid;
		gap: var(--sp-16);
		max-width: var(--app-max);
	}

	p {
		margin: 0;
	}

	.row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--sp-12);
		min-height: var(--touch);
		padding: var(--sp-6) 0;
		border-top: var(--border);
		cursor: pointer;
	}

	.main {
		border-top: 0;
		font-weight: var(--fw-medium);
	}

	/* Interruptor de los de toda la vida: una pastilla con un círculo. */
	input[type='checkbox'] {
		appearance: none;
		flex: none;
		position: relative;
		width: calc(var(--touch) + var(--sp-6));
		height: calc(var(--sp-24) + var(--sp-4));
		margin: 0;
		border-radius: var(--app-radius-pill);
		background: var(--line);
		cursor: pointer;
		transition: background var(--app-dur);
	}

	input[type='checkbox']::after {
		content: '';
		position: absolute;
		top: var(--sp-2);
		left: var(--sp-2);
		width: var(--sp-24);
		height: var(--sp-24);
		border-radius: var(--app-radius-pill);
		background: var(--fg);
		transition: translate var(--app-dur);
	}

	input[type='checkbox']:checked {
		background: var(--amber);
	}

	input[type='checkbox']:checked::after {
		translate: calc(var(--touch) + var(--sp-6) - var(--sp-24) - var(--sp-4)) 0;
		background: var(--on-amber);
	}

	select {
		min-height: var(--touch);
		padding: 0 var(--sp-10);
		border: var(--border);
		border-radius: var(--app-radius-s);
		background: var(--raise);
		color: var(--fg);
		font: inherit;
	}

	.hint {
		color: var(--muted);
		font-size: var(--app-fs-small);
	}

	.status {
		min-height: var(--sp-20);
		color: var(--muted);
		font-size: var(--app-fs-small);
	}

	.more {
		color: var(--amber);
		font-size: var(--app-fs-small);
	}
</style>

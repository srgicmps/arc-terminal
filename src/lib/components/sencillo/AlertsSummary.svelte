<!-- «Tus avisos» en Inicio: si los tienes encendidos y de qué temas, y los avisos del tiempo en vigor. -->
<script lang="ts">
	import { GROUPS } from '#lib/alertconfig.ts';
	import { alerts, loadAlerts } from '#lib/sencillo/alerts.svelte.ts';
	import { ALERT_NAMES, type WxAlert } from '#lib/weather.ts';

	let { weather = [] }: { weather?: WxAlert[] } = $props();

	$effect(loadAlerts);

	const topics = $derived(GROUPS.filter((g) => alerts.config.groups.includes(g.id)).map((g) => g.label.toLowerCase()));
</script>

<div class="sum">
	{#each weather.slice(0, 2) as a (a.id)}
		<p class="wx {a.level}"><span class="dot" aria-hidden="true"></span>Aviso {ALERT_NAMES[a.level].toLowerCase()} por {a.hazard.toLowerCase()} en {a.area}</p>
	{/each}
	{#if alerts.phase === 'ready'}
		{#if alerts.config.on}
			<p>Te avisamos al móvil de: {topics.join(', ') || 'nada todavía'}.</p>
		{:else}
			<p>Tienes los avisos al móvil apagados.</p>
		{/if}
	{:else if alerts.phase === 'none' || alerts.phase === 'error'}
		<p>Con tu cuenta en arcterminal.dev puedes recibir en el móvil lo importante, cuando pasa.</p>
	{:else}
		<p class="mut">Cargando…</p>
	{/if}
	{#if !weather.length}<p class="mut">No hay avisos del tiempo en vigor.</p>{/if}
</div>

<style>
	.sum {
		display: grid;
		gap: var(--sp-8);
	}

	p {
		margin: 0;
	}

	.mut {
		color: var(--muted);
		font-size: var(--app-fs-small);
	}

	.wx {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		font-weight: var(--fw-medium);
	}

	.dot {
		width: var(--sp-10);
		height: var(--sp-10);
		flex: none;
		border-radius: var(--app-radius-pill);
		background: var(--amber);
	}

	.red .dot {
		background: var(--down);
	}
</style>

<!-- Huracanes activos y eventos naturales abiertos (incendios, volcanes…). -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, when } from '#lib/format.ts';
	import type { HazardsData } from '#lib/types.ts';

	let { hazards }: { hazards: HazardsData } = $props();

	const CLASS: Record<string, string> = {
		HU: 'Huracán',
		MH: 'Huracán mayor',
		TS: 'Tormenta tropical',
		TD: 'Depresión tropical',
		STS: 'Tormenta subtropical',
		STD: 'Depresión subtropical',
		PTC: 'Ciclón potencial',
		PC: 'Postropical'
	};
	const CATEGORY: Record<string, string> = {
		Wildfires: 'Incendio',
		Volcanoes: 'Volcán',
		'Severe Storms': 'Tormenta',
		Floods: 'Inundación',
		'Sea and Lake Ice': 'Hielo',
		Earthquakes: 'Terremoto',
		Drought: 'Sequía',
		'Dust and Haze': 'Polvo',
		Landslides: 'Deslizamiento',
		Snow: 'Nieve',
		'Temperature Extremes': 'Temperatura extrema'
	};
	const coords = (lat: number, lon: number) =>
		Number.isFinite(lat) && Number.isFinite(lon)
			? `${nf(Math.abs(lat), 1)}°${lat >= 0 ? 'N' : 'S'} ${nf(Math.abs(lon), 1)}°${lon >= 0 ? 'E' : 'O'}`
			: '';
</script>

<ul class="hz">
	{#each hazards.storms as s (s.id)}
		<li>
			<span class="kind storm">{CLASS[s.classification] ?? s.classification}</span>
			<a href={s.url} target="_blank" rel="noopener"><b>{s.name}</b> · {nf(s.knots * 1.852, 0)} km/h · {s.pressure} hPa</a>
			<small>{coords(s.lat, s.lon)} · {when(s.updated, clock.now)}</small>
		</li>
	{/each}
	{#each hazards.events.slice(0, 25) as e (e.id)}
		<li>
			<span class="kind">{CATEGORY[e.category] ?? e.category}</span>
			<a href={e.url} target="_blank" rel="noopener">{e.title}</a>
			<small>{[e.magnitude, coords(e.lat, e.lon), when(e.date, clock.now)].filter(Boolean).join(' · ')}</small>
		</li>
	{/each}
	{#if !hazards.storms.length && !hazards.events.length}
		<li><span class="kind">—</span><span>Nada activo ahora mismo.</span></li>
	{/if}
</ul>

<style>
	.hz {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	li {
		display: grid;
		grid-template-columns: 96px minmax(0, 1fr);
		gap: var(--sp-2) var(--sp-10);
		padding: var(--sp-7) var(--pad-x);
		border-bottom: var(--border);
	}

	li:last-child {
		border-bottom: 0;
	}

	.kind {
		grid-row: span 2;
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-tight);
		text-transform: uppercase;
		padding-top: var(--sp-2);
	}

	.kind.storm {
		color: var(--amber);
	}

	a {
		color: var(--fg);
		text-decoration: none;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	a:hover {
		color: var(--amber);
	}

	b {
		font-weight: var(--fw-bold);
	}

	small {
		color: var(--faint);
		font-size: var(--fs-xs);
	}
</style>

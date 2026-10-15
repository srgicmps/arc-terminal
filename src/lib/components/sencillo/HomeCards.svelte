<!--
	«Tu casa» en tarjetas: luz más barata, gasolina y tiempo de «Tu sitio» (y, en la pestaña entera, aire, polen y
	avisos del tiempo). Se calcula en el navegador: depende de la hora y del sitio elegido.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { zoneFor } from '#lib/fuel.ts';
	import { place } from '#lib/place.svelte.ts';
	import { fuelFact, luzFact, weatherPhrase, type FuelProvinceLite, type WeatherLite } from '#lib/sencillo/casa.ts';
	import type { Fact } from '#lib/sencillo/facts.ts';
	import type { PricePoint } from '#lib/types.ts';
	import { aqiLevel, POLLEN_KEYS, POLLEN_NAMES, pollenLevel, sky, uvLevel, type AirNow } from '#lib/weather.ts';
	import FactCard from './FactCard.svelte';

	interface Props {
		data: {
			pvpc: PricePoint[];
			fuelSpain: number | null;
			fuelProvinces: FuelProvinceLite[];
			cheapest: { name: string; town: string; price: number }[];
			weather: WeatherLite[];
			air?: { place: string; now: AirNow } | null;
		};
		/** En Inicio, solo luz, gasolina y tiempo. */
		full?: boolean;
	}

	let { data, full = false }: Props = $props();

	const luz = $derived(clock.now ? luzFact(data.pvpc, clock.now) : null);
	const fuel = $derived(fuelFact(place.current, zoneFor(place.current, data.fuelProvinces), data.fuelProvinces, data.cheapest, data.fuelSpain));
	// El tiempo de «Tu sitio» si es una de las ciudades de weather.json; si no, la primera.
	const w = $derived(data.weather.find((p) => p.name === place.current.name) ?? data.weather[0]);
	const weather = $derived<Fact | null>(
		w
			? {
					id: 'tiempo',
					title: `El tiempo en ${w.name}`,
					value: `${sky(w.current.code).icon} ${Math.round(w.current.temp)}°`,
					delta: null,
					change: w.daily[0] ? `${sky(w.current.code).label} · máxima ${Math.round(w.daily[0].max)}°, mínima ${Math.round(w.daily[0].min)}°` : sky(w.current.code).label,
					phrase: weatherPhrase(w),
					spark: [],
					explain: 'tiempo',
					when: 'ahora',
					source: 'Open-Meteo'
				}
			: null
	);
	const air = $derived.by<Fact | null>(() => {
		const a = data.air;
		const aqi = aqiLevel(a?.now.aqi);
		if (!a || !aqi) return null;
		const pollen = POLLEN_KEYS.map((k) => ({ k, level: pollenLevel(k, a.now.pollen[k]) })).filter((p) => p.level && p.level.label !== 'Nulo');
		const worst = pollen.find((p) => p.level!.tone === 'bad') ?? pollen.find((p) => p.level!.tone === 'mid') ?? pollen[0];
		const uv = uvLevel(a.now.uv);
		return {
			id: 'aire',
			title: `Aire y polen en ${a.place}`,
			value: `Aire ${aqi.label.toLowerCase()}`,
			delta: null,
			change: worst ? `Polen de ${POLLEN_NAMES[worst.k].toLowerCase()}: ${worst.level!.label.toLowerCase()}` : 'Sin polen en el aire',
			phrase: `La calidad del aire es ${aqi.label.toLowerCase()}${uv ? ` y el sol (índice UV) está ${uv.label.toLowerCase()}` : ''}.${worst && worst.level!.tone !== 'ok' ? ' Si tienes alergia, ojo hoy.' : ''}`,
			spark: [],
			explain: 'aire',
			when: 'ahora',
			source: 'Open-Meteo (Copernicus)'
		};
	});

	const cards = $derived([luz, fuel, weather, ...(full ? [air] : [])].filter((f): f is Fact => !!f));
</script>

{#if cards.length}
	<div class="cards">
		{#each cards as f (f.id)}<FactCard fact={f} />{/each}
	</div>
{:else}
	<p class="empty">Aún no hay datos de luz, gasolina ni tiempo.</p>
{/if}

<style>
	.cards {
		display: grid;
		gap: var(--sp-12);
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
	}

	.empty {
		color: var(--muted);
	}
</style>

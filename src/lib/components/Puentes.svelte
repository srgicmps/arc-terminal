<!--
	CAL, «Puentes» (F6): próximos festivos entre semana y los puentes que dan, de España (con los de tu comunidad)
	o de tu país. Los festivos (holidays-world.json, unos 100 KB) se piden al abrir el panel, no al cargar la vista.
	La lógica está en src/lib/puentes.ts.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { asset } from '$app/paths';
	import Panel from './Panel.svelte';
	import Seg from './ui/Seg.svelte';
	import Select from './ui/Select.svelte';
	import { COUNTRIES } from '#lib/countries.ts';
	import { dm, weekday } from '#lib/format.ts';
	import { place } from '#lib/place.svelte.ts';
	import { ES_REGIONS, esRegion, holidaysFor, upcomingBreaks, weekendOf, type WorldHolidaysData } from '#lib/puentes.ts';

	interface Props {
		/** Hoy en Madrid, «2026-10-15». */
		today: string;
		/** Día que resalta «CAL viernes». */
		pick?: string | null;
		/** Avisa a la vista del próximo puente (frase del modo Sencillo). */
		onnext?: (text: string | null) => void;
	}
	let { today, pick = null, onnext }: Props = $props();

	let data = $state<WorldHolidaysData | null>(null);
	let failed = $state(false);
	onMount(async () => {
		try {
			const res = await fetch(asset('data/holidays-world.json' as Parameters<typeof asset>[0]));
			if (!res.ok) throw new Error(String(res.status));
			data = (await res.json()).data;
		} catch {
			failed = true;
		}
	});

	// España siempre; además, el país de Tu sitio si tiene festivos.
	const myCc = $derived(place.current.cc && place.current.cc !== 'ES' && data?.countries[place.current.cc] ? place.current.cc : null);
	const name = (cc: string) => COUNTRIES.find((c) => c.code === cc)?.name ?? cc;
	let country = $state<string>('ES');
	const options = $derived([{ value: 'ES', label: 'España' }, ...(myCc ? [{ value: myCc, label: name(myCc) }] : [])]);
	let region = $state<string>('');
	$effect(() => {
		// Hasta que se lee Tu sitio (place.ready), place.current es Madrid: al recargar se quedaba ES-MD.
		if (!region && place.ready) region = (place.current.cc === 'ES' && esRegion(place.current.admin1)) || 'ES-MD';
	});
	const items = $derived(data?.countries[country === 'ES' || country === myCc ? country : 'ES'] ?? []);
	const breaks = $derived(upcomingBreaks(holidaysFor(items, country === 'ES' ? region : null), today, 365, weekendOf(country === myCc && myCc ? myCc : 'ES')).slice(0, 10));

	/** «sáb 7 nov» */
	const short = (d: string) => `${weekday(d)} ${dm(`${d}T12:00:00Z`).split(' ')[1]}`;
	const title = (b: (typeof breaks)[number]) => b.holidays.flatMap((h) => h.names).join(' · ');
	$effect(() => {
		const b = breaks[0];
		onnext?.(
			b
				? `El próximo descanso es ${title(b)}: del ${short(b.from)} al ${short(b.to)}, ${b.days} días${b.take.length ? `, pidiendo ${b.take.map(short).join(' y ')}` : ''}.`
				: null
		);
	});
</script>

<Panel title="Puentes" meta="Festivos entre semana · próximos 12 meses">
	<div class="pick">
		{#if options.length > 1}<Seg label="País" {options} bind:value={country} />{/if}
		{#if country === 'ES'}
			<Select label="Comunidad" bind:value={region}>
				{#each ES_REGIONS as r (r.code)}<option value={r.code}>{r.name}</option>{/each}
			</Select>
		{/if}
	</div>
	{#if failed}
		<p class="empty">No se han podido cargar los festivos.</p>
	{:else if !data}
		<p class="empty">Cargando…</p>
	{:else if !breaks.length}
		<p class="empty">No quedan festivos entre semana en los próximos 12 meses.</p>
	{:else}
		<ul class="mini">
			{#each breaks as b (b.from)}
				<li class:hl={b.holidays.some((h) => h.date === pick)}>
					<span class="l"
						>{title(b)}<small
							>{short(b.from)} – {short(b.to)}{#if b.take.length}&nbsp;· pide {b.take.map(short).join(' y ')}{/if}</small
						></span
					>
					<b class:long={b.days >= 4}>{b.days} días</b>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet note()}
		Cada festivo entre semana con su fin de semana y, si con 1 o 2 días de vacaciones se hace puente, cuáles pedir.
		Sin los festivos locales de cada municipio. Fuente: Nager.Date.
	{/snippet}
</Panel>

<style>
	.pick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		padding: var(--sp-8) var(--pad-x);
	}
	.long {
		color: var(--amber);
	}
	small {
		display: block;
		color: var(--muted);
		font-size: var(--fs-xs);
	}
	li.hl {
		background: var(--amber-soft);
	}
</style>

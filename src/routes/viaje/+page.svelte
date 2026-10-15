<script lang="ts">
	// VIAJE <ciudad> (F5): tiempo a 7 días, hora local, moneda, aviso de viaje y festivos de la ciudad que busques.
	// Junta datos que ya hay: Open-Meteo (desde el navegador, como Tu sitio), BCE, Departamento de Estado de EE. UU.
	// y Nager.Date (holidays-world). La ciudad va en la URL (?ciudad=Tokio): «VIAJE Tokio» en la barra.
	import { asset } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import { LEVELS, advisoryFor } from '#lib/advisories.ts';
	import { clock } from '#lib/clock.svelte.ts';
	import { COUNTRIES } from '#lib/countries.ts';
	import { dm, hmIn, nf, weekday } from '#lib/format.ts';
	import { fxRates } from '#lib/fx.ts';
	import { fetchLocal, type LocalWeather } from '#lib/localweather.ts';
	import { searchPlaces, type Place } from '#lib/place.ts';
	import { phrases } from '#lib/plain.ts';
	import type { WorldHolidaysData } from '#lib/puentes.ts';
	import { writeParams } from '#lib/urlstate.svelte.ts';
	import { dayIn, dayNote, offsetFromMadrid, offsetLabel, tripHolidays } from '#lib/viaje.ts';
	import { sky } from '#lib/weather.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/** Atajos cuando aún no hay ciudad. */
	const QUICK = ['Lisboa', 'París', 'Londres', 'Roma', 'Nueva York', 'Tokio'];

	let query = $state('');
	let city = $state<Place | null>(null);
	let wx = $state<LocalWeather | null>(null);
	let holidays = $state<WorldHolidaysData | null>(null);
	/** Si no se ha podido leer holidays-world.json (para no quedarse en «Cargando…»). */
	let holidaysFailed = $state(false);
	/** Si Open-Meteo no ha dado el tiempo de la ciudad (para no quedarse en «Pidiendo el tiempo…»). */
	let wxFailed = $state(false);
	let message = $state('');

	// La ciudad de la URL: la busca en Open-Meteo y pide su tiempo. Sin ?ciudad (VIAJE a secas), se vacía.
	// Buscar y los atajos la escriben con una navegación «shallow» (writeParams): en SvelteKit 3 eso no cambia
	// page.url, sino page.shallow.url, así que se mira primero esa.
	$effect(() => {
		const q = (page.shallow?.url ?? page.url).searchParams.get('ciudad');
		untrack(() => (q ? open(q) : clear()));
	});

	// Cada búsqueda lleva su número: si llega tarde la respuesta de una ciudad anterior, se descarta.
	let seq = 0;
	let ctrl: AbortController | null = null;

	function clear() {
		seq++;
		ctrl?.abort();
		query = '';
		city = null;
		wx = null;
		wxFailed = false;
		message = '';
	}

	async function open(q: string) {
		const id = ++seq;
		ctrl?.abort();
		const signal = (ctrl = new AbortController()).signal;
		query = q;
		message = 'Buscando…';
		wx = null;
		wxFailed = false;
		let found: Place | undefined;
		try {
			[found] = await searchPlaces(q, signal);
		} catch {
			if (id === seq) message = 'No se ha podido buscar la ciudad. Prueba otra vez en un momento.';
			return;
		}
		if (id !== seq) return;
		if (!found) {
			city = null;
			message = `No encuentro «${q}».`;
			return;
		}
		city = found;
		message = '';
		loadHolidays();
		try {
			const w = await fetchLocal(found, signal);
			if (id === seq) wx = w;
		} catch {
			if (id === seq) wxFailed = true;
		}
	}

	async function loadHolidays() {
		if (holidays) return;
		holidaysFailed = false;
		try {
			const res = await fetch(asset('data/holidays-world.json' as Parameters<typeof asset>[0]));
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			holidays = (await res.json()).data;
		} catch {
			holidaysFailed = true;
		}
	}

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const q = query.trim();
		if (q) writeParams({ ciudad: q });
	}

	const now = $derived(clock.now || Date.now());
	const tz = $derived(wx?.tz || city?.tz || '');
	const country = $derived(COUNTRIES.find((c) => c.code === city?.cc));
	const offset = $derived(tz ? offsetFromMadrid(tz, now) : null);
	const rates = $derived(fxRates(data.fx?.data.series ?? []));
	const currency = $derived(country?.currency ?? '');
	const rate = $derived(currency && currency !== 'EUR' ? rates.get(currency) : undefined);
	const advisory = $derived(city?.cc && data.advisories ? advisoryFor(data.advisories.data.items, city.cc) : undefined);
	// «Hoy» es el del destino: en Tokio, a las 18:00 de Madrid ya es mañana y el festivo de hoy aquí ya pasó allí.
	const today = $derived(dayIn(tz, now));
	const note = $derived(tz ? dayNote(tz, now) : '');
	const hols = $derived(city?.cc ? tripHolidays(holidays?.countries[city.cc] ?? [], today, 60) : []);
	const hasHolidays = $derived(!!city?.cc && !!holidays?.countries[city.cc]);
	const days = $derived(wx?.weather.daily.slice(0, 7) ?? []);

	const plain = $derived(
		city
			? phrases([
					tz ? `En ${city.name} son las ${hmIn(new Date(now).toISOString(), tz)}: ${offsetLabel(offset)}${note ? ` (${note})` : ''}.` : null,
					rate ? `Un euro vale ${nf(rate.perEur, rate.perEur >= 100 ? 0 : 2)} ${currency}.` : null,
					advisory ? `Aviso de viaje de EE. UU.: ${LEVELS[advisory.level].toLowerCase()} (nivel ${advisory.level} de 4).` : null,
					hasHolidays ? (hols.length ? `Próximo festivo: ${hols[0].names[0]}, el ${dm(`${hols[0].date}T12:00:00Z`)}.` : 'No hay festivos en los próximos dos meses.') : null
				])
			: []
	);
</script>

<ViewHeader code="VIAJE" title={city ? `Viaje a ${city.name}` : 'Viaje'} sub="Tiempo, hora, moneda, aviso de viaje y festivos de cualquier ciudad" {plain} />

<div class="grid">
	<div class="col">
		<Panel title="Destino" meta={city ? `${city.name}${city.country ? ` · ${city.country}` : ''}` : 'Elige una ciudad'}>
			<form class="find" onsubmit={submit}>
				<input bind:value={query} placeholder="Ciudad: Tokio, Lisboa…" aria-label="Ciudad del viaje" enterkeyhint="search" />
				<button type="submit">Buscar</button>
			</form>
			{#if !city}
				<div class="quick">
					{#each QUICK as q (q)}<button type="button" onclick={() => writeParams({ ciudad: q })}>{q}</button>{/each}
				</div>
			{/if}
			{#if message}<p class="empty">{message}</p>{:else if !city}<p class="empty">Escribe una ciudad para ver su tiempo, su hora, su moneda y si hay festivos.</p>{/if}
			{#if city}
				<Tiles cols={4}>
					<Tile label="Hora local" value={tz ? hmIn(new Date(now).toISOString(), tz) : '—'} sub={[offsetLabel(offset), note].filter(Boolean).join(' · ')} />
					<Tile
						label="Moneda"
						value={!currency ? '—' : currency === 'EUR' ? 'Euro' : rate ? `1 € = ${nf(rate.perEur, rate.perEur >= 100 ? 0 : 2)} ${currency}` : currency}
						sub={currency === 'EUR' ? 'no hace falta cambiar' : rate ? `BCE, ${dm(`${rate.date}T12:00:00Z`)}` : currency ? 'el BCE no la publica' : ''}
					/>
					<Tile
						label="Aviso de viaje"
						value={advisory ? `Nivel ${advisory.level}` : '—'}
						tone={!advisory ? 'mut' : advisory.level >= 3 ? 'down' : advisory.level === 1 ? 'up' : undefined}
						sub={advisory ? LEVELS[advisory.level] : 'sin aviso de EE. UU.'}
					/>
					<Tile
						label="Próximo festivo"
						value={hols[0] ? dm(`${hols[0].date}T12:00:00Z`) : '—'}
						tone={hols[0] ? undefined : 'mut'}
						sub={hols[0] ? hols[0].names.join(' · ') : hasHolidays ? 'ninguno en 2 meses' : holidays ? 'sin datos de ese país' : ''}
					/>
				</Tiles>
			{/if}
		</Panel>
	</div>
</div>

{#if city}
	<div class="grid grid-2">
		<div class="col">
			<Panel title="El tiempo" meta="{city.name} · 7 días">
				{#if wxFailed}
					<p class="empty">No se ha podido pedir el tiempo de {city.name} ahora mismo.</p>
				{:else if !wx}
					<p class="empty">Pidiendo el tiempo…</p>
				{:else}
					<Table>
						<thead><tr><th>Día</th><th class="l">Cielo</th><th>Máx.</th><th>Mín.</th><th>Lluvia</th></tr></thead>
						<tbody>
							{#each days as d (d.date)}
								{@const s = sky(d.code)}
								<tr>
									<td class="mut">{weekday(d.date)}</td>
									<td class="l sky"><span aria-hidden="true">{s.icon}</span>&nbsp;{s.label}</td>
									<td>{nf(d.max, 0)}°</td>
									<td class="mut">{nf(d.min, 0)}°</td>
									<td class="mut">{nf(d.rain, 0)} %</td>
								</tr>
							{/each}
						</tbody>
					</Table>
				{/if}
				{#snippet note()}Fuente: Open-Meteo (CC BY 4.0).{/snippet}
			</Panel>
		</div>
		<div class="col">
			<Panel title="Festivos" meta="{country?.name ?? city.country} · próximos 2 meses">
				{#if holidaysFailed}
					<p class="empty">No se han podido cargar los festivos.</p>
				{:else if !holidays}
					<p class="empty">Cargando…</p>
				{:else if !hasHolidays}
					<p class="empty">No hay festivos de este país en la terminal.</p>
				{:else if !hols.length}
					<p class="empty">Ninguno en los próximos dos meses.</p>
				{:else}
					<ul class="mini">
						{#each hols as h (h.date)}
							<li>
								<span class="l">{h.names.join(' · ')}{#if h.regional}<small> · solo en algunas regiones</small>{/if}</span>
								<b>{weekday(h.date)} {dm(`${h.date}T12:00:00Z`).split(' ')[1]}</b>
							</li>
						{/each}
					</ul>
				{/if}
				{#snippet note()}Fuente: Nager.Date. En festivo, tiendas y museos pueden cerrar.{/snippet}
			</Panel>
			{#if advisory}
				<Panel title="Aviso de viaje" meta="Departamento de Estado de EE. UU.">
					<ul class="mini">
						<li><span class="l">{LEVELS[advisory.level]}</span><b>Nivel {advisory.level} de 4</b></li>
						<li><span class="l">Actualizado</span><span class="mut">{dm(advisory.updated)}</span></li>
					</ul>
					{#snippet note()}
						<a href={advisory.url} target="_blank" rel="noopener">Ver el aviso completo</a> (en inglés). Para españoles, mira también las
						recomendaciones de viaje del Ministerio de Asuntos Exteriores · <Updated at={data.advisories?.fetchedAt} source="advisories" />
					{/snippet}
				</Panel>
			{/if}
		</div>
	</div>
{/if}

<style>
	.find,
	.quick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-6);
		padding: var(--sp-8) var(--pad-x);
	}
	.quick {
		padding-top: 0;
	}
	.quick button {
		height: var(--control-h);
		padding: 0 var(--sp-10);
		background: none;
		border: var(--hair) solid var(--line);
		color: var(--fg);
		font-size: var(--fs-s);
		cursor: pointer;
	}
	.quick button:hover {
		border-color: var(--amber-edge);
		color: var(--amber);
	}
	.find input {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--sp-9);
		background: var(--bg);
		border: var(--hair) solid var(--line);
		color: var(--fg);
		font: inherit;
	}
	.find button {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		background: none;
		border: var(--hair) solid var(--amber-edge);
		color: var(--amber);
		font-size: var(--fs-s);
		cursor: pointer;
	}
	/* El cielo puede partirse en dos líneas: así caben la mínima y la lluvia en el móvil sin scroll lateral. */
	.sky {
		white-space: normal;
	}
	small {
		color: var(--muted);
		font-size: var(--fs-xs);
	}
</style>

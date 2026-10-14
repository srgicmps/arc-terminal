<script lang="ts">
	import ClimatePanel from '#lib/components/ClimatePanel.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import StormNotice from '#lib/components/StormNotice.svelte';
	import SunArc from '#lib/components/SunArc.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { dm, hm, hmIn, nf, weekday } from '#lib/format.ts';
	import { fetchLocal, type LocalWeather } from '#lib/localweather.ts';
	import { inMenorca, learnTimezone, place, searchPlaces, setPlace } from '#lib/place.svelte.ts';
	import {
		ALERT_NAMES,
		POLLEN_KEYS,
		POLLEN_NAMES,
		aqiLevel,
		compass,
		hoursMinutes,
		moon,
		pollenLevel,
		seaLevel,
		signedMinSec,
		sky,
		uvLevel
	} from '#lib/weather.ts';
	import Table from '#lib/components/ui/Table.svelte';
	import Tile from '#lib/components/ui/Tile.svelte';
	import Tiles from '#lib/components/ui/Tiles.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Tu sitio (place.svelte.ts): su tiempo, aire y mar se piden desde el navegador. weather.json y air.json
	// (Menorca y unas pocas ciudades fijas) quedan como reserva y como comparación.
	const here = $derived(place.current);
	const menorca = $derived(inMenorca(here));

	// Avisos en Europa (alerts-eu): todos los países, del que más avisos graves tiene al que menos, y las zonas
	// en naranja o rojo del país de tu sitio (España si no es uno de los que se siguen). Tu provincia, primero.
	const euName = (code: string) => new Intl.DisplayNames('es', { type: 'region' }).of(code) ?? code;
	const euRows = $derived(
		[...(data.alertsEu?.data.countries ?? [])].sort(
			(a, b) => b.counts.red - a.counts.red || b.counts.orange - a.counts.orange || b.counts.yellow - a.counts.yellow
		)
	);
	const euHere = $derived(euRows.find((c) => c.code === here.cc) ?? euRows.find((c) => c.code === 'ES'));
	const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
	const isMine = (area: string) =>
		[here.admin2, here.admin1].some((n) => !!n && euHere?.code === here.cc && fold(area).includes(fold(n)));
	const euZones = $derived([...(euHere?.zones ?? [])].sort((a, b) => Number(isMine(b.area)) - Number(isMine(a.area))));
	let local = $state<LocalWeather | null>(null);
	let localError = $state('');

	// Se vuelve a pedir solo si cambia el sitio (no cuando se le añade la zona horaria).
	const placeKey = $derived(`${here.lat},${here.lon},${here.name}`);
	$effect(() => {
		if (!place.ready || !placeKey) return;
		const p = untrack(() => place.current);
		const ctrl = new AbortController();
		local = null;
		localError = '';
		fetchLocal(p, ctrl.signal)
			.then((d) => {
				local = d;
				learnTimezone(p, d.tz);
			})
			.catch(() => {
				if (!ctrl.signal.aborted) localError = `No se pudo pedir el tiempo de ${p.name} ahora mismo.`;
			});
		return () => ctrl.abort();
	});

	// «LUGAR Tokio» llega como /wx?buscar=Tokio: se busca, se elige el primer resultado y se limpia la URL.
	$effect(() => {
		const q = page.url.searchParams.get('buscar');
		if (!q || !place.ready) return;
		searchPlaces(q)
			.then(([first]) => (first ? setPlace(first) : (localError = `No encuentro «${q}».`)))
			.catch(() => (localError = 'No se pudo buscar el sitio.'))
			.finally(() => goto(resolve('/wx'), { replaceState: true }));
	});

	const fixed = $derived(data.weather?.data.places ?? []);
	// El sitio elegido, primero; si no llega, el mismo de weather.json (Menorca), si está.
	const main = $derived(local?.weather ?? fixed.find((p) => p.name === here.name) ?? (menorca ? fixed[0] : null) ?? null);
	const places = $derived(main ? [main, ...fixed.filter((p) => p.name !== main.name)] : fixed);
	// Costas norte y sur solo en Menorca; en otro sitio con mar, el oleaje frente a él.
	const coasts = $derived(menorca ? (data.weather?.data.coasts ?? []) : local?.sea ? [local.sea] : []);
	const air = $derived(local?.air ?? (menorca ? (data.air?.data ?? null) : null));
	// Los avisos de MeteoAlarm que guarda la Action son los de Menorca.
	const alerts = $derived(data.alerts?.data.alerts ?? null);
	const tz = $derived(local?.tz || here.tz || 'Europe/Madrid');

	// Solo los pólenes que se notan algún día (fuera de temporada, CAMS los deja vacíos o a cero).
	const pollens = $derived(
		air ? POLLEN_KEYS.filter((k) => air.days.some((d) => (d.pollen[k] ?? 0) >= 1)) : []
	);
	const aqiNow = $derived(aqiLevel(air?.now.aqi));
	// La luna se calcula en el navegador; antes de arrancar (clock.now = 0) se usa la hora de los datos.
	const luna = $derived(moon(clock.now || Date.parse(data.weather?.fetchedAt ?? '') || 0));

	/** Las fechas de los avisos, en hora de Madrid: «14 oct 12:00». */
	const at = (iso: string) => (iso ? `${dm(iso)} ${hm(iso)}` : '');
	/** «2026-10-14T13:00» (hora local de Open-Meteo) → «13:00». */
	const hour = (t: string) => t.slice(11, 16);
	const m = (v: number | null) => (v === null ? '—' : `${nf(v, 1)} m`);
</script>

<ViewHeader code="WX" title="El tiempo" sub="{here.name} y otras ciudades · Open-Meteo, CAMS y MeteoAlarm" />

{#if localError}<p class="empty">{localError}</p>{/if}

<StormNotice data={data.swpc?.data} />

<div class="grid grid-2e">
	<div class="col">
		{#if menorca}
		<Panel title="Avisos · Menorca" meta="AEMET vía MeteoAlarm">
			{#if alerts === null}
				<p class="empty">Sin datos de avisos todavía.</p>
			{:else if !alerts.length}
				<p class="empty">Sin avisos.</p>
			{:else}
				<ul class="mini">
					{#each alerts as a (a.id)}
						<li class="al al-{a.level}">
							<a class="l" href={a.url} target="_blank" rel="noopener">
								{a.hazard}
								<small>{a.area} · {at(a.onset)}{#if a.expires} → {at(a.expires)}{/if}</small>
							</a>
							<b>{ALERT_NAMES[a.level]}</b>
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>
		{/if}

		{#if euRows.length}
		<Panel title="Avisos en Europa" meta="En vigor y próximos · por país">
			<Table>
				<thead><tr><th class="l">País</th><th>Rojos</th><th>Naranjas</th><th>Amarillos</th></tr></thead>
				<tbody>
					{#each euRows as c (c.code)}
						<tr>
							<td class="l name">{euName(c.code)}</td>
							<td class:mut={!c.counts.red}>{c.counts.red}</td>
							<td class:mut={!c.counts.orange}>{c.counts.orange}</td>
							<td class="mut">{c.counts.yellow}</td>
						</tr>
					{/each}
				</tbody>
			</Table>
			{#if euHere}
				{#if euZones.length}
					<ul class="mini">
						{#each euZones as z (z.area)}
							<li class="al al-{z.level}">
								<a class="l" href={z.url} target="_blank" rel="noopener">
									{z.area}{#if isMine(z.area)}<small>Tu provincia · {z.hazards.join(', ')}</small>{:else}<small>{z.hazards.join(', ')}</small>{/if}
								</a>
								<b>{ALERT_NAMES[z.level]}</b>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="empty">Ninguna zona de {euName(euHere.code)} en naranja o rojo.</p>
				{/if}
			{/if}
			{#snippet note()}
				Zonas en naranja o rojo{#if euHere}&nbsp;de {euName(euHere.code)}{/if}. Fuente: EUMETNET-MeteoAlarm, con los avisos de cada
				servicio meteorológico nacional (el oficial es el suyo) · <Updated at={data.alertsEu?.fetchedAt} source="alerts-eu" />
			{/snippet}
		</Panel>
		{/if}

		{#if menorca || coasts.length}
		<Panel title="Mar · {menorca ? 'Menorca' : here.name}" meta={menorca ? 'Norte frente a sur' : 'Frente a la costa'}>
			{#if !coasts.length}
				<p class="empty">Sin datos del mar todavía.</p>
			{:else}
				<Table>
					<thead>
						<tr><th>Costa</th><th class="l">Estado</th><th>Ola</th><th>Fondo</th><th class="wide">Periodo</th><th class="wide">De</th></tr>
					</thead>
					<tbody>
						{#each coasts as c (c.name)}
							{@const lv = seaLevel(c.now.wave)}
							<tr>
								<td>{c.name}<span class="sub">{c.spot}</span></td>
								<td class="l">{#if lv}<span class="lv lv-{lv.tone}">{lv.label}</span>{:else}—{/if}</td>
								<td>{m(c.now.wave)}</td>
								<td class="mut">{m(c.now.swell)}</td>
								<td class="mut wide">{c.now.wavePeriod === null ? '—' : `${nf(c.now.wavePeriod, 0)} s`}</td>
								<td class="mut wide">{c.now.waveDir === null ? '—' : compass(c.now.waveDir)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
				<div class="sep">
					<Table>
										<thead>
											<tr>
												<th>Ola máx.</th>
												{#each coasts[0].daily as d (d.date)}<th>{weekday(d.date)}</th>{/each}
											</tr>
										</thead>
										<tbody>
											{#each coasts as c (c.name)}
												<tr>
													<td>{c.name}</td>
													{#each c.daily as d (d.date)}
														{@const lv = seaLevel(d.waveMax)}
														<td class="lv-{lv?.tone ?? 'ok'}">{m(d.waveMax)}</td>
													{/each}
												</tr>
											{/each}
										</tbody>
					</Table>
				</div>
			{/if}
		</Panel>
		{/if}
		{#if main?.sun}
			{@const sun = main.sun}
			<Panel title="Sol y luna · {main.name}" meta={`${luna.name} · ${nf(luna.illumination * 100, 0)} %`}>
				<div class="arc">
					<SunArc sunrise={sun.sunrise} sunset={sun.sunset} now={clock.now} />
				</div>
				<Tiles>
					<Tile label="Sol" value="{hmIn(sun.sunrise, tz)} – {hmIn(sun.sunset, tz)}" sub="Salida y puesta · hora de {main.name}" />
					<Tile
						label="Duración del día"
						value={hoursMinutes(sun.daylight)}
						sub={sun.delta === null ? '' : `${signedMinSec(sun.delta)} que ayer`}
					/>
					<Tile label="Luna" value="{nf(luna.illumination * 100, 0)} %" sub="{luna.name} · iluminada" />
				</Tiles>
			</Panel>
		{/if}
	</div>

	<div class="col">
		<Panel title="Aire · {air?.place ?? here.name}" meta="Índice europeo">
			{#if !air}
				<!-- El aire de tu sitio llega desde el navegador: mientras tanto, «pidiendo»; si falla, se dice. -->
				<p class="empty">
					{local || localError ? `Sin datos del aire para ${here.name}.` : `Pidiendo el aire de ${here.name}…`}
				</p>
			{:else}
				<Tiles>
					{#if aqiNow}
						<Tile label="Índice" value={nf(air.now.aqi, 0)}><span class="lv lv-{aqiNow.tone}">{aqiNow.label}</span></Tile>
					{:else}
						<Tile label="Índice" value={nf(air.now.aqi, 0)} />
					{/if}
					<Tile label="PM2,5 · PM10" value="{nf(air.now.pm25, 0)} · {nf(air.now.pm10, 0)}" sub="Partículas, µg/m³" />
					<Tile label="O₃ · NO₂" value="{nf(air.now.o3, 0)} · {nf(air.now.no2, 0)}" sub="Gases, µg/m³" />
				</Tiles>
				<Table>
					<thead>
						<tr><th>Hora local</th>{#each air.hours as h (h.time)}<th>{hour(h.time)}</th>{/each}</tr>
					</thead>
					<tbody>
						<tr>
							<td>Aire</td>
							{#each air.hours as h (h.time)}<td class="lv-{aqiLevel(h.aqi)?.tone ?? 'ok'}">{nf(h.aqi, 0)}</td>{/each}
						</tr>
						<tr>
							<td>UV</td>
							{#each air.hours as h (h.time)}<td class="lv-{uvLevel(h.uv)?.tone ?? 'ok'}">{nf(h.uv, 0)}</td>{/each}
						</tr>
					</tbody>
				</Table>
			{/if}
		</Panel>

		{#if air}
			{@const uvNow = uvLevel(air.now.uv)}
			<Panel title="UV y polen" meta={uvNow ? `UV ahora ${nf(air.now.uv, 0)} · ${uvNow.label}` : undefined}>
				<Table>
					<thead>
						<tr>
							<th>Máx.</th>
							{#each air.days as d (d.date)}<th>{weekday(d.date)}</th>{/each}
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>Aire</td>
							{#each air.days as d (d.date)}<td class="lv-{aqiLevel(d.aqi)?.tone ?? 'ok'}">{nf(d.aqi, 0)}</td>{/each}
						</tr>
						<tr>
							<td>UV</td>
							{#each air.days as d (d.date)}
								{@const lv = uvLevel(d.uv)}
								<td class="lv-{lv?.tone ?? 'ok'}">{nf(d.uv, 0)}<span class="sub">{lv?.label ?? ''}</span></td>
							{/each}
						</tr>
						{#each pollens as k (k)}
							<tr>
								<td>{POLLEN_NAMES[k]}</td>
								{#each air.days as d (d.date)}
									{@const lv = pollenLevel(k, d.pollen[k])}
									<td class="lv-{lv?.tone ?? 'ok'}">{lv?.label ?? '—'}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</Table>
				{#if !pollens.length}<p class="empty">Polen: nulo o sin datos estos días.</p>{/if}
				{#snippet note()}
					Partículas y gases en µg/m³. Polen en granos/m³, con umbrales orientativos.
				{/snippet}
			</Panel>
		{/if}
		<ClimatePanel climate={data.climate} />
		{#if data.neo}
			{@const neo = data.neo}
			<Panel title="Asteroides cercanos" meta="Próximos 30 días · a menos de 10 distancias lunares">
				{#if neo.data.length}
					<Table>
						<thead><tr><th class="l">Asteroide</th><th>Día</th><th>Distancia</th><th>Tamaño</th></tr></thead>
						<tbody>
							{#each neo.data as a (a.des + a.date)}
								<tr>
									<td class="l name">{a.des}</td>
									<td class="mut">{dm(a.date)}</td>
									<td>{nf(a.ld, a.ld < 1 ? 2 : 1)} DL</td>
									<td class="mut"
										>{a.size ? (a.size.measured ? `${nf(a.size.min, 0)} m` : `${nf(a.size.min, 0)}–${nf(a.size.max, 0)} m`) : '—'}</td
									>
								</tr>
							{/each}
						</tbody>
					</Table>
				{:else}
					<p class="empty">Ningún asteroide conocido pasará a menos de 10 distancias lunares en los próximos 30 días.</p>
				{/if}
				{#snippet note()}
					DL: distancia lunar (384 400 km). Tamaño medido o, si no, estimado por su brillo. Fuente:
					<a href="https://cneos.jpl.nasa.gov/ca/" target="_blank" rel="noopener">NASA JPL, CNEOS</a> · <Updated at={neo.fetchedAt} source="neo" />
				{/snippet}
			</Panel>
		{/if}
	</div>
</div>

{#if !places.length}<p class="empty">Sin datos todavía.</p>{/if}

<div class="grid grid-2e">
	{#each places as p (p.name)}
		{@const now = sky(p.current.code)}
		<div class="col">
			<Panel title={p.name} meta={p === main ? `Tu sitio · ${now.label}` : now.label}>
				<div class="now">
					<span class="icon" aria-hidden="true">{now.icon}</span>
					<b>{nf(p.current.temp, 0)}°</b>
					<ul>
						<li>Viento <span>{nf(p.current.wind, 0)} km/h {compass(p.current.windDir)}</span></li>
						<li>Humedad <span>{nf(p.current.humidity, 0)} %</span></li>
						{#if p.sea !== null}<li>Agua del mar <span>{nf(p.sea, 1)}°</span></li>{/if}
					</ul>
				</div>
				<Table>
					<thead><tr><th>Día</th><th class="l">Cielo</th><th>Máx.</th><th>Mín.</th><th>Lluvia</th><th>Viento</th></tr></thead>
					<tbody>
						{#each p.daily as d (d.date)}
							{@const s = sky(d.code)}
							<tr>
								<td>{weekday(d.date)}</td>
								<td class="l"><span class="i" aria-hidden="true">{s.icon}</span> {s.label}</td>
								<td>{nf(d.max, 0)}°</td>
								<td class="mut">{nf(d.min, 0)}°</td>
								<td class:rain={d.rain >= 50}>{nf(d.rain, 0)} %</td>
								<td class="mut">{nf(d.wind, 0)}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</Panel>
		</div>
	{/each}
</div>
<p class="foot">
	Fuentes: Open-Meteo (CC BY 4.0) · Calidad del aire, UV y polen: contiene información modificada del Servicio de
	Vigilancia Atmosférica de Copernicus (CAMS), vía Open-Meteo · Avisos: EUMETNET-MeteoAlarm con datos de AEMET; el
	aviso oficial es el de <a href="https://www.aemet.es/es/eltiempo/prediccion/avisos" target="_blank" rel="noopener">AEMET</a>
	{#if local}· Tu sitio: pedido a Open-Meteo desde tu navegador a las {hm(local.fetchedAt)} h de Madrid{/if}
	· Tiempo <Updated at={data.weather?.fetchedAt} source="weather" /> · Aire <Updated at={data.air?.fetchedAt} source="air" /> · Avisos
	<Updated at={data.alerts?.fetchedAt} source="alerts" />
</p>

<style>
	.now {
		display: flex;
		align-items: center;
		gap: var(--sp-16);
		padding: var(--sp-12);
		border-bottom: var(--border);
	}

	.icon {
		color: var(--amber);
		font-size: var(--fs-big);
		line-height: 1;
	}

	.now b {
		font-size: var(--fs-xxl);
		font-weight: var(--fw-medium);
	}

	.now ul {
		list-style: none;
		margin: 0 0 0 auto;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-s);
		text-align: right;
	}

	.now li span {
		color: var(--fg);
	}

	.i {
		color: var(--amber);
	}

	.rain {
		color: var(--amber);
	}

	/* En el móvil, la tabla del mar se queda con lo esencial (como .t .sub en ui/Table.svelte). */
	@container (max-width: 390px) {
		.wide {
			display: none;
		}
	}

	/* Hueco del arco del sol: el mismo relleno que un recuadro de cifra. */
	.arc {
		background: var(--panel);
		padding: var(--sp-12);
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
	}

	.sep {
		border-top: var(--border);
	}

	/* Niveles: discreto, ámbar o rojo. El punto acompaña al texto, que es el que manda. */
	.lv {
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.lv::before {
		content: "●";
		margin-right: 0.4em;
		font-size: var(--fs-xs);
	}

	.lv-ok {
		color: var(--muted);
	}

	.lv-mid {
		color: var(--amber);
	}

	.lv-bad {
		color: var(--down);
	}

	/* Avisos (lista .mini): una línea fina del color del aviso a la izquierda y el nivel en ese color. */
	.al {
		border-left: var(--hair) solid var(--c);
	}

	.al b {
		color: var(--c);
	}

	/* Colores sacados de los tokens del tema: amarillo = ámbar aclarado. */
	.al-yellow {
		--c: color-mix(in srgb, var(--amber) 55%, var(--fg));
	}

	.al-orange {
		--c: var(--amber);
	}

	.al-red {
		--c: var(--down);
	}

	.foot {
		margin: var(--sp-8) 0 0;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.foot a {
		color: var(--muted);
	}
</style>

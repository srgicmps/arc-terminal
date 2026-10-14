<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import SunArc from '#lib/components/SunArc.svelte';
	import { clock } from '#lib/clock.svelte.ts';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import { dm, hm, nf, weekday } from '#lib/format.ts';
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
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const places = $derived(data.weather?.data.places ?? []);
	const coasts = $derived(data.weather?.data.coasts ?? []);
	const air = $derived(data.air?.data ?? null);
	const alerts = $derived(data.alerts?.data.alerts ?? null);

	// Solo los pólenes que se notan algún día (fuera de temporada, CAMS los deja vacíos o a cero).
	const pollens = $derived(
		air ? POLLEN_KEYS.filter((k) => air.days.some((d) => (d.pollen[k] ?? 0) >= 1)) : []
	);
	const aqiNow = $derived(aqiLevel(air?.now.aqi));
	const mao = $derived(places.find((p) => p.name === 'Maó') ?? null);
	// La luna se calcula en el navegador; antes de arrancar (clock.now = 0) se usa la hora de los datos.
	const luna = $derived(moon(clock.now || Date.parse(data.weather?.fetchedAt ?? '') || 0));

	/** Las fechas de los avisos, en hora de Madrid: «14 oct 12:00». */
	const at = (iso: string) => (iso ? `${dm(iso)} ${hm(iso)}` : '');
	/** «2026-10-14T13:00» (hora local de Open-Meteo) → «13:00». */
	const hour = (t: string) => t.slice(11, 16);
	const m = (v: number | null) => (v === null ? '—' : `${nf(v, 1)} m`);
</script>

<ViewHeader code="WX" title="El tiempo" sub="Menorca, Madrid, Barcelona y Nueva York · Open-Meteo, CAMS y MeteoAlarm" />

<div class="grid grid-2e">
	<div class="col">
		<Panel title="Avisos · Menorca" meta="AEMET vía MeteoAlarm">
			{#if alerts === null}
				<p class="empty">Sin datos de avisos todavía.</p>
			{:else if !alerts.length}
				<p class="empty">Sin avisos.</p>
			{:else}
				<ul class="alerts">
					{#each alerts as a (a.id)}
						<li class="al al-{a.level}">
							<a href={a.url} target="_blank" rel="noopener">
								<span class="al-h"><b>{ALERT_NAMES[a.level]}</b> · {a.hazard}</span>
								<span class="al-m">{a.area} · {at(a.onset)}{#if a.expires} → {at(a.expires)}{/if}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/if}
		</Panel>

		<Panel title="Mar · Menorca" meta="Norte frente a sur">
			{#if !coasts.length}
				<p class="empty">Sin datos del mar todavía.</p>
			{:else}
				<div class="scroll">
					<table class="t">
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
					</table>
				</div>
				<div class="scroll sep">
					<table class="t">
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
					</table>
				</div>
			{/if}
		</Panel>
		{#if mao?.sun}
			{@const sun = mao.sun}
			<Panel title="Sol y luna · Maó" meta={`${luna.name} · ${nf(luna.illumination * 100, 0)} %`}>
				<div class="sky">
					<SunArc sunrise={sun.sunrise} sunset={sun.sunset} now={clock.now} />
					<ul>
						<li>Sale <span>{hm(sun.sunrise)}</span></li>
						<li>Se pone <span>{hm(sun.sunset)}</span></li>
						<li>
							Día <span>{hoursMinutes(sun.daylight)}</span>
							{#if sun.delta !== null}<span class="mut">({signedMinSec(sun.delta)} que ayer)</span>{/if}
						</li>
						<li>Luna <span>{luna.name}, {nf(luna.illumination * 100, 0)} % iluminada</span></li>
					</ul>
				</div>
			</Panel>
		{/if}
	</div>

	<div class="col">
		<Panel title="Aire · {air?.place ?? 'Maó'}" meta="Índice europeo">
			{#if !air}
				<p class="empty">Sin datos de calidad del aire todavía.</p>
			{:else}
				<div class="now">
					<b>{nf(air.now.aqi, 0)}</b>
					{#if aqiNow}<span class="lv lv-{aqiNow.tone}">{aqiNow.label}</span>{/if}
					<ul>
						<li>PM2,5 <span>{nf(air.now.pm25, 0)}</span></li>
						<li>PM10 <span>{nf(air.now.pm10, 0)}</span></li>
						<li>O₃ <span>{nf(air.now.o3, 0)}</span></li>
						<li>NO₂ <span>{nf(air.now.no2, 0)}</span></li>
					</ul>
				</div>
				<div class="scroll">
					<table class="t">
						<thead>
							<tr><th>Hora</th>{#each air.hours as h (h.time)}<th>{hour(h.time)}</th>{/each}</tr>
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
					</table>
				</div>
			{/if}
		</Panel>

		{#if air}
			{@const uvNow = uvLevel(air.now.uv)}
			<Panel title="UV y polen" meta={uvNow ? `UV ahora ${nf(air.now.uv, 0)} · ${uvNow.label}` : undefined}>
				<div class="scroll">
					<table class="t">
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
					</table>
				</div>
				{#if !pollens.length}<p class="empty">Polen: nulo o sin datos estos días.</p>{/if}
				{#snippet note()}
					Partículas y gases en µg/m³. Polen en granos/m³, con umbrales orientativos.
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
			<Panel title={p.name} meta={now.label}>
				<div class="now">
					<span class="icon" aria-hidden="true">{now.icon}</span>
					<b>{nf(p.current.temp, 0)}°</b>
					<ul>
						<li>Viento <span>{nf(p.current.wind, 0)} km/h {compass(p.current.windDir)}</span></li>
						<li>Humedad <span>{nf(p.current.humidity, 0)} %</span></li>
						{#if p.sea !== null}<li>Agua del mar <span>{nf(p.sea, 1)}°</span></li>{/if}
					</ul>
				</div>
				<div class="scroll">
					<table class="t">
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
					</table>
				</div>
			</Panel>
		</div>
	{/each}
</div>
<p class="foot">
	Fuentes: Open-Meteo (CC BY 4.0) · Calidad del aire, UV y polen: contiene información modificada del Servicio de
	Vigilancia Atmosférica de Copernicus (CAMS), vía Open-Meteo · Avisos: EUMETNET-MeteoAlarm con datos de AEMET; el
	aviso oficial es el de <a href="https://www.aemet.es/es/eltiempo/prediccion/avisos" target="_blank" rel="noopener">AEMET</a>
	· Tiempo <Updated at={data.weather?.fetchedAt} /> · Aire <Updated at={data.air?.fetchedAt} /> · Avisos
	<Updated at={data.alerts?.fetchedAt} />
</p>

<style>
	.now {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 12px;
		border-bottom: 1px solid var(--line);
	}

	.icon {
		color: var(--amber);
		font-size: 26px;
		line-height: 1;
	}

	.now b {
		font-size: var(--fs-xxl);
		font-weight: 500;
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

	@container (max-width: 420px) {
		.wide {
			display: none;
		}
	}

	.sky {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		align-items: center;
		gap: 12px 16px;
		padding: 12px;
	}

	.sky ul {
		list-style: none;
		margin: 0;
		padding: 0;
		color: var(--muted);
		font-size: var(--fs-s);
		line-height: 1.7;
	}

	.sky li span {
		color: var(--fg);
	}

	.sky li span.mut {
		color: var(--muted);
	}

	@container (max-width: 420px) {
		.sky {
			grid-template-columns: minmax(0, 1fr);
		}
	}

	.sep {
		border-top: 1px solid var(--line);
	}

	/* Niveles: discreto, ámbar o rojo. El punto acompaña al texto, que es el que manda. */
	.lv {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	.lv::before {
		content: '';
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.8;
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

	/* Avisos: una línea fina del color del aviso a la izquierda. */
	.alerts {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.al + .al {
		border-top: 1px solid var(--line);
	}

	.al a {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 12px 8px 10px;
		border-left: 2px solid var(--c);
		color: var(--fg);
		text-decoration: none;
	}

	.al a:hover {
		background: var(--raise);
	}

	.al-yellow {
		--c: #d9c25b;
	}

	.al-orange {
		--c: #ef8a3c;
	}

	.al-red {
		--c: var(--down);
	}

	.al-h {
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	.al-h b {
		color: var(--c);
		font-weight: 500;
	}

	.al-m {
		color: var(--muted);
		font-size: var(--fs-xs);
	}

	.foot {
		margin: 8px 0 0;
		color: var(--faint);
		font-size: var(--fs-xs);
		line-height: 1.6;
	}

	.foot a {
		color: var(--muted);
	}
</style>

<script lang="ts">
	import LineChart from '#lib/components/LineChart.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import { distanceKm, FUELS, type FuelKey, type FuelStation } from '#lib/fuel.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Estado de la vista (como ref() en Vue).
	let fuel = $state<FuelKey>('g95');
	let town = $state('ALL');
	// Orden de la lista. «near» usa la ubicación del navegador, que nunca sale del dispositivo.
	let sort = $state<'price' | 'near'>('price');
	let here = $state<{ lat: number; lon: number } | null>(null);
	let geoStatus = $state<'idle' | 'asking' | 'error'>('idle');

	function sortByDistance() {
		if (here) return void (sort = 'near');
		if (!('geolocation' in navigator)) return void (geoStatus = 'error');
		geoStatus = 'asking';
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				here = { lat: pos.coords.latitude, lon: pos.coords.longitude };
				geoStatus = 'idle';
				sort = 'near';
			},
			() => (geoStatus = 'error'),
			{ maximumAge: 300_000, timeout: 10_000 }
		);
	}

	// Valores calculados (como computed() en Vue): se recalculan solos cuando cambia fuel o town.
	const stations = $derived(data.fuel?.data.stations ?? []);
	const towns = $derived(
		[...new Set(stations.map((s) => s.town))].sort((a, b) => a.localeCompare(b, 'es'))
	);
	// Solo las estaciones que venden el combustible elegido, con su precio a mano.
	const priced = $derived(
		stations.flatMap((s) => {
			const price = s.prices[fuel];
			return price === null ? [] : [{ ...s, price }];
		})
	);
	const byPrice = $derived(
		priced.filter((s) => town === 'ALL' || s.town === town).sort((a, b) => a.price - b.price)
	);
	const list = $derived.by(() => {
		if (!here) return byPrice.map((s) => ({ ...s, km: null }));
		const withKm = byPrice.map((s) => ({ ...s, km: distanceKm(here!, s) }));
		return sort === 'near' ? withKm.sort((a, b) => a.km - b.km) : withKm;
	});
	const islandPrices = $derived(priced.map((s) => s.price));
	const avg = $derived(islandPrices.reduce((a, b) => a + b, 0) / (islandPrices.length || 1));
	const min = $derived(Math.min(...islandPrices));
	const max = $derived(Math.max(...islandPrices));
	const best = $derived(byPrice[0]);
	// Lo que ahorras llenando 50 L en la más barata en vez de pagar la media de la isla.
	const save = $derived(best ? (avg - best.price) * 50 : 0);
	const fuelLabel = $derived(FUELS.find((f) => f.key === fuel)?.label);
	// «14/10/2026 12:30:05» → «14/10/2026, 12:30»
	const sourceDate = $derived.by(() => {
		const [day, time = ''] = (data.fuel?.data.sourceDate ?? '').split(' ');
		return time ? `${day}, ${time.slice(0, 5)}` : day;
	});

	const fmt = (n: number, decimals: number) =>
		n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

	const mapUrl = (s: FuelStation) =>
		`https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}`;

	const history = $derived(data.fuel?.data.history ?? []);
	const historyLines = $derived(
		FUELS.map((f, i) => ({
			label: `${f.label}, media`,
			color: i ? '--muted' : '--amber',
			points: history.flatMap((d) => (d.avg[f.key] === null ? [] : [{ t: d.date, v: d.avg[f.key]! }]))
		}))
	);

	// Ancho de la barra: la más barata, corta; la más cara, entera.
	const barWidth = (price: number) => 20 + (80 * (price - min)) / (max - min || 1);
</script>

<svelte:head>
	<title>FUEL · Arc Terminal</title>
</svelte:head>

<div class="vh">
	<div>
		<h1><span class="code">FUEL</span>Gasolineras de Menorca</h1>
		<p>API abierta de precios de carburantes del Ministerio</p>
	</div>
</div>

<div class="grid">
	<section class="panel">
		<header class="ph">
			<h2>{fuelLabel}</h2>
			<div class="ph-r">
				<span>{list.length} {list.length === 1 ? 'estación' : 'estaciones'}</span>
			</div>
		</header>

		{#if !data.fuel}
			<p class="empty">Todavía no hay datos. En local, ejecuta <code>pnpm data</code> y recarga.</p>
		{:else}
			<div class="controls">
				<div class="seg" role="group" aria-label="Combustible">
					{#each FUELS as f (f.key)}
						<button type="button" aria-pressed={fuel === f.key} onclick={() => (fuel = f.key)}>
							{f.label}
						</button>
					{/each}
				</div>
				<label class="sel">
					Municipio
					<!-- bind:value es el v-model de Svelte -->
					<select bind:value={town}>
						<option value="ALL">Toda la isla</option>
						{#each towns as t (t)}
							<option value={t}>{t}</option>
						{/each}
					</select>
				</label>
				<div class="seg" role="group" aria-label="Ordenar">
					<button type="button" aria-pressed={sort === 'price'} onclick={() => (sort = 'price')}>
						Precio
					</button>
					<button type="button" aria-pressed={sort === 'near'} onclick={sortByDistance}>
						Cerca de mí
					</button>
				</div>
				{#if geoStatus === 'asking'}
					<span class="geo">Buscando tu ubicación…</span>
				{:else if geoStatus === 'error'}
					<span class="geo">No se ha podido obtener tu ubicación.</span>
				{/if}
			</div>

			{#if best}
				<div class="tiles">
					<div class="tile">
						<span class="lbl">Más barata{town === 'ALL' ? '' : ` en ${town}`}</span>
						<b>{fmt(best.price, 3)} €/L</b>
						<span class="sub">{best.town} · {best.name}</span>
					</div>
					<div class="tile">
						<span class="lbl">Media de Menorca</span>
						<b>{fmt(avg, 3)} €/L</b>
						<span class="sub">{priced.length} estaciones</span>
					</div>
					<div class="tile">
						<span class="lbl">{save >= 0 ? 'Ahorras' : 'Pagas de más'} en un depósito de 50 L</span>
						<b>{fmt(Math.abs(save), 2)} €</b>
						<span class="sub">en la más barata, frente a la media</span>
					</div>
				</div>

				<div class="scroll">
					<table class="t">
						<thead>
							<tr>
								<th>#</th>
								<th class="l">Estación</th>
								<th class="l">Municipio</th>
								{#if here}<th>km</th>{/if}
								<th>€/L</th>
								<th class="sp"><span class="sr">Comparativa</span></th>
								<th>Frente a la media</th>
								<th>Horario</th>
							</tr>
						</thead>
						<tbody>
							{#each list as s, i (s.id)}
								{@const diff = s.price - avg}
								<tr class:best={s.id === best?.id}>
									<td class="mut">{i + 1}</td>
									<td class="l">
										<a class="name" href={mapUrl(s)} target="_blank" rel="noopener">{s.name}</a>
										<span class="sub">{s.address}</span>
									</td>
									<td class="l">{s.town}</td>
									{#if s.km !== null}<td class="mut">{fmt(s.km, 1)}</td>{/if}
									<td>{fmt(s.price, 3)}</td>
									<td class="sp">
										<span class="bar" aria-hidden="true">
											<i style:width="{barWidth(s.price).toFixed(0)}%"></i>
										</span>
									</td>
									<td class={diff < 0 ? 'up' : diff > 0 ? 'down' : 'flat'}>
										{diff < 0 ? '−' : '+'}{fmt(Math.abs(diff), 3)}
									</td>
									<td class="mut">{s.schedule}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="empty">Ninguna estación de {town} tiene {fuelLabel?.toLowerCase()}.</p>
			{/if}

			<p class="pnote">
				Fuente: <a href="https://geoportalgasolineras.es/" target="_blank" rel="noopener"
					>Ministerio para la Transición Ecológica y el Reto Demográfico</a
				>. Datos del {sourceDate}. Toca una estación para abrirla en el mapa. Con «Cerca de mí», tu ubicación solo se usa en este dispositivo.
			</p>
		{/if}
	</section>
</div>

<div class="grid">
	<div class="col">
		<Panel title="Evolución en Menorca" meta="Precio medio diario · €/L">
			<LineChart lines={historyLines} decimals={3} />
		</Panel>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 10px 18px;
		padding: 10px 12px;
		border-bottom: 1px solid var(--line);
	}

	.seg {
		display: inline-flex;
		border: 1px solid var(--line);
	}

	.seg button {
		background: none;
		border: 0;
		padding: 5px 12px;
		cursor: pointer;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.seg button[aria-pressed='true'] {
		background: var(--amber);
		color: var(--on-amber);
		font-weight: 500;
	}

	.sel {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--muted);
		font-size: var(--fs-s);
	}

	.sel select {
		background: var(--raise);
		border: 1px solid var(--line);
		color: var(--fg);
		padding: 4px 8px;
		font-size: var(--fs-s);
	}

	.geo {
		color: var(--muted);
		font-size: var(--fs-s);
	}

	a.name {
		color: inherit;
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.bar {
		display: block;
		position: relative;
		height: 6px;
		min-width: 80px;
		background: var(--raise);
	}

	.bar i {
		position: absolute;
		inset: 0 auto 0 0;
		background: var(--faint);
	}

	tr.best .bar i {
		background: var(--up);
	}

	code {
		color: var(--amber);
	}

	/* En pantallas estrechas la barra cede su sitio a los números. */
	@container (max-width: 480px) {
		.sp {
			display: none;
		}
	}

</style>

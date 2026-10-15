<!--
	SEAS: estacionalidad mensual de una serie (/seas?s=WTI). Como G, descarga el catálogo y el archivo de la
	serie en el navegador; el cálculo está en #lib/seasonal.ts.
-->
<script lang="ts">
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Change from '#lib/components/ui/Change.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { loadCatalog, loadPoints } from '#lib/gfetch.ts';
	import { resolve, type CatalogEntry } from '#lib/gseries.ts';
	import { MONTHS, seasonality } from '#lib/seasonal.ts';
	import type { Point } from '#lib/types.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';

	const sel = urlState<string>('s', 'US10', (v) => v.trim().length > 0);

	let catalog = $state<CatalogEntry[] | null>(null);
	let failed = $state(false);
	let points = $state<{ id: string; pts: Point[] } | null>(null);

	$effect(() => {
		loadCatalog()
			.then((c) => (catalog = c))
			.catch(() => (failed = true));
	});

	const entry = $derived(catalog ? resolve(sel.value, catalog) : null);
	$effect(() => {
		const e = entry;
		if (e && points?.id !== e.id) loadPoints(e).then((pts) => (points = { id: e.id, pts }));
	});

	const s = $derived(entry && points?.id === entry.id ? seasonality(points.pts, entry.unit) : null);
	// Tipos en %: el cambio va en pb; otras series en diferencia (paro, inflación…), en pp; el resto, en %.
	const scale = $derived(s?.mode === 'diff' && entry?.unit === '%' ? 100 : 1);
	const unit = $derived(s?.mode === 'pct' ? ' %' : entry?.unit === '%' || entry?.unit === 'pb' ? ' pb' : ' pp');
	const digits = $derived(scale === 100 || entry?.unit === 'pb' ? 0 : s?.mode === 'pct' ? 1 : 2);
	const val = (v: number | null) => (v === null ? null : v * scale);
	const years = $derived(s ? s.years.length : 0);
</script>

<ViewHeader code="SEAS" title="Estacionalidad" sub={entry ? `${entry.label}${entry.geo ? ` · ${entry.geo}` : ''}` : 'Escribe una serie: WTI, US10, euríbor'} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Por meses" meta={s ? `cambio mensual en${unit} · ${s.from} a ${s.to}` : ''}>
			<div class="controls">
				<ChipInput label="Cambiar de serie" placeholder="WTI, US10, euríbor…" items={[sel.value]} onadd={(v) => (sel.value = v)} />
			</div>
			{#if failed}
				<p class="empty">No se ha podido cargar el catálogo de series.</p>
			{:else if !catalog || (entry && !s && points?.id !== entry.id)}
				<p class="empty">Cargando…</p>
			{:else if !entry}
				<p class="empty">Ninguna serie con ese nombre. Búscala en G («Series disponibles»).</p>
			{:else if !s}
				<p class="empty">Esta serie no tiene datos mensuales o diarios seguidos.</p>
			{:else}
				<Table>
					<thead>
						<tr><th>Mes</th><th>Media</th><th>Mediana</th><th title="Años en que subió, de los que hay">Al alza</th></tr>
					</thead>
					<tbody>
						{#each s.months as m, i (i)}
							<tr>
								<td class="name">{MONTHS[i]}</td>
								<td><Change value={val(m.mean)} {digits} {unit} /></td>
								<td><Change value={val(m.median)} {digits} {unit} /></td>
								<td class="mut">{m.n ? `${m.up} de ${m.n}` : '—'}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			{/if}
			{#snippet note()}
				{#if s && years < 3}<strong>Historial corto</strong>: {years === 1 ? 'un año' : `${years} años`} ({s.count} meses); la media dice poco. {/if}
				Último dato de cada mes frente al del mes anterior. Solo el historial que guarda la terminal.
			{/snippet}
		</Panel>
	</div>
	<div class="col">
		<Panel title="Año a año" meta={s ? `${years} ${years === 1 ? 'año' : 'años'}` : ''}>
			{#if s}
				<Table>
					<thead>
						<tr><th>Año</th>{#each MONTHS as m (m)}<th>{m}</th>{/each}</tr>
					</thead>
					<tbody>
						{#each s.years as y (y.year)}
							<tr>
								<td class="name">{y.year}</td>
								{#each y.months as v, i (i)}
									<td><Change value={val(v)} {digits} text={v === null ? '' : undefined} /></td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</Table>
			{:else}
				<p class="empty">—</p>
			{/if}
		</Panel>
	</div>
</div>

<style>
	.controls {
		padding: var(--sp-8) var(--pad-x);
	}
</style>

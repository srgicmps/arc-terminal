<!--
	G: gráfico de cualquier serie que ya se descarga (/g?s=US10,BUND). Al abrirse, descarga el catálogo
	(/data/g/series.json, generado al construir) y después solo el archivo de static/data de cada serie pedida.
	Con varias series de unidades distintas, «Base 100» las pone a 100 en la primera fecha común.
-->
<script lang="ts">
	import LineChart from '#lib/components/LineChart.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import ChipInput from '#lib/components/ui/ChipInput.svelte';
	import Search from '#lib/components/ui/Search.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import Table from '#lib/components/ui/Table.svelte';
	import { nf } from '#lib/format.ts';
	import { loadCatalog, loadPoints } from '#lib/gfetch.ts';
	import { parseTokens, rebase, resolve, searchCatalog, SHORTCUTS, type CatalogEntry } from '#lib/gseries.ts';
	import type { Point } from '#lib/types.ts';
	import { urlState } from '#lib/urlstate.svelte.ts';

	const COLORS = ['--amber', '--series-2', '--series-3', '--muted', '--fg', '--faint'];

	const sel = urlState<string>('s', 'US10,BUND', (v) => parseTokens(v).length > 0);
	const tokens = $derived(parseTokens(sel.value));

	let catalog = $state<CatalogEntry[] | null>(null);
	let failed = $state(false);
	/** Puntos de cada serie ya descargada, por id. */
	let points = $state<Record<string, Point[]>>({});
	let mode = $state<'valor' | 'base'>('valor');
	let query = $state('');

	$effect(() => {
		loadCatalog()
			.then((c) => (catalog = c))
			.catch(() => (failed = true));
	});

	const picked = $derived(tokens.map((token) => ({ token, entry: catalog ? resolve(token, catalog) : null })));
	const found = $derived(picked.flatMap((p) => (p.entry ? [p.entry] : [])));
	const missing = $derived(catalog ? picked.filter((p) => !p.entry).map((p) => p.token) : []);

	$effect(() => {
		for (const e of found) {
			if (points[e.id]) continue;
			loadPoints(e).then((p) => (points = { ...points, [e.id]: p }));
		}
	});

	const units = $derived([...new Set(found.map((e) => e.unit))]);
	const base = $derived(mode === 'base' && found.length > 1);
	const lines = $derived.by(() => {
		const raw = found.map((e) => points[e.id] ?? []);
		const shown = base ? rebase(raw) : raw;
		return found.map((e, i) => ({ label: `${e.label}${e.geo ? ` · ${e.geo}` : ''}`, points: shown[i], color: COLORS[i % COLORS.length] }));
	});
	const ready = $derived(found.length > 0 && found.every((e) => points[e.id]));
	const short = $derived(found.filter((e) => (points[e.id]?.length ?? e.n) < 24));
	const results = $derived(catalog ? searchCatalog(query, catalog) : []);

	const set = (list: string[]) => (sel.value = list.join(','));
	const add = (token: string) => set([...tokens, token]);
	const remove = (token: string) => set(tokens.filter((t) => t !== token));
	const lastOf = (id: string) => points[id]?.at(-1);
</script>

<ViewHeader code="G" title="Gráfico de series" sub={found.length ? found.map((e) => e.label).join(' · ') : 'Escribe una o varias series: US10, BUND, euríbor'} />

<div class="grid grid-2">
	<div class="col">
		<Panel title="Gráfico" meta={found.length > 1 ? (base ? 'base 100' : units.join(' · ')) : (found[0]?.unit ?? '')}>
			<div class="controls">
				<ChipInput label="Añadir una serie" placeholder="US10, euríbor, sofr…" items={tokens} onadd={add} onremove={remove} />
				{#if found.length > 1}
					<Seg label="Escala" options={[{ value: 'valor', label: 'Valores' }, { value: 'base', label: 'Base 100' }]} bind:value={mode} />
				{/if}
			</div>
			{#if failed}
				<p class="empty">No se ha podido cargar el catálogo de series.</p>
			{:else if !catalog || (found.length && !ready)}
				<p class="empty">Cargando…</p>
			{:else if !found.length}
				<p class="empty">Ninguna serie con ese nombre. Búscala en «Series disponibles».</p>
			{:else}
				<LineChart {lines} unit={base ? '' : units.length === 1 ? units[0] : ''} decimals={2} height={260} />
			{/if}
			{#snippet note()}
				{#if missing.length}No encontrada: {missing.join(', ')}. {/if}
				{#if units.length > 1 && !base}Unidades distintas ({units.join(', ')}): prueba «Base 100». {/if}
				{#if short.length}Historial corto en {short.map((e) => e.label).join(', ')}: solo lo que guarda la terminal. {/if}
				Datos de los archivos que ya descarga la terminal; cada serie, con su frecuencia.
			{/snippet}
		</Panel>
		{#if found.length}
			<Panel title="Series del gráfico">
				<Table>
					<thead>
						<tr><th>Serie</th><th>Último</th><th class="per">Fecha</th><th class="per">Desde</th><th class="l">Archivo</th></tr>
					</thead>
					<tbody>
						{#each found as e (e.id)}
							<tr>
								<td class="name">{e.label}{#if e.geo}<span class="sub"> {e.geo}</span>{/if}</td>
								<td>{lastOf(e.id) ? `${nf(lastOf(e.id)!.v, 2)} ${e.unit}` : '—'}</td>
								<td class="per mut">{lastOf(e.id)?.t ?? '—'}</td>
								<td class="per mut">{e.from}</td>
								<td class="l mut">{e.ds}</td>
							</tr>
						{/each}
					</tbody>
				</Table>
			</Panel>
		{/if}
	</div>
	<div class="col">
		<Panel title="Series disponibles" meta={catalog ? `${catalog.length} series` : ''}>
			<Search label="Buscar una serie" placeholder="Buscar: bono, paro, euríbor…" bind:value={query} />
			<Table maxHeight="420px" csv={false}>
				<thead><tr><th>{query ? 'Serie' : 'Atajo'}</th><th class="l">{query ? 'Unidad' : 'Serie'}</th></tr></thead>
				<tbody>
					{#if query}
						{#each results as e (e.id)}
							<tr>
								<td class="l"><button class="pick" onclick={() => add(e.id)}>{e.label}{e.geo ? ` · ${e.geo}` : ''}</button></td>
								<td class="l mut">{e.unit}</td>
							</tr>
						{:else}
							<tr><td class="l mut" colspan="2">Nada con «{query}».</td></tr>
						{/each}
					{:else}
						{#each SHORTCUTS as s (s.code)}
							<tr>
								<td class="l"><button class="pick" onclick={() => add(s.code)}>{s.code}</button></td>
								<td class="l mut">{s.name}</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</Table>
			{#snippet note()}Toca una para añadirla. En la barra: «G US10, BUND».{/snippet}
		</Panel>
	</div>
</div>

<style>
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		align-items: center;
		padding: var(--sp-8) var(--pad-x);
	}
	.pick {
		all: unset;
		cursor: pointer;
		color: var(--fg);
	}
	.pick:hover,
	.pick:focus-visible {
		color: var(--amber);
	}
</style>

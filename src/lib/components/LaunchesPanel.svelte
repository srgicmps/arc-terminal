<!--
	Panel «Próximos lanzamientos» (TECH): cuenta atrás del siguiente y tabla con los 8 próximos, en hora
	de Madrid. Carga él solo sus datos (static/data/launches.json), así la vista solo tiene que ponerlo.
-->
<script lang="ts">
	import { dataset, type Dataset } from '#lib/data.ts';
	import { dm, hm } from '#lib/format.ts';
	import { countdown, inProgress, nextLaunch, pending, type Launch, type LaunchesData } from '#lib/launches.ts';
	import Panel from './Panel.svelte';
	import Table from './ui/Table.svelte';
	import Updated from './Updated.svelte';

	// undefined: cargando · null: aún no hay archivo (en local, antes de `pnpm data`).
	let ds = $state<Dataset<LaunchesData> | null | undefined>(undefined);
	// Hora actual, al segundo. 0 al construir: en el HTML estático no hay cuenta atrás.
	let now = $state(0);

	// $effect solo corre en el navegador (como onMounted en Vue).
	$effect(() => {
		dataset<LaunchesData>('launches').then((d) => (ds = d));
	});

	// El reloj de la cuenta atrás. La función que devuelve el $effect se ejecuta al desmontar el
	// componente (como onUnmounted): ahí se para el intervalo.
	$effect(() => {
		now = Date.now();
		const id = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(id);
	});

	const all = $derived(ds?.data.launches ?? []);
	// Ya en el navegador, fuera los que terminaron; al construir (now = 0), todos.
	const rows = $derived(now ? pending(all, now) : all);
	const next = $derived(now ? nextLaunch(all, now) : null);
	const live = $derived(now ? inProgress(all, now) : []);
	const started = (l: Launch) => !!now && Date.parse(l.net) <= now;
	const detail = (l: Launch) => [l.rocket, l.location || l.pad].filter(Boolean).join(' · ');
</script>

<Panel title="Próximos lanzamientos" meta="Hora de Madrid">
	{#if ds === undefined}
		<p class="empty">Cargando…</p>
	{:else if !rows.length}
		<p class="empty">Sin lanzamientos previstos en los datos.</p>
	{:else}
		{#if next || live.length}
			<div class="count">
				{#each live as l (l.id)}
					<p class="live"><span class="lbl">En curso</span> <span class="what">{l.mission} · {l.rocket}</span></p>
				{/each}
				{#if next}
					<p>
						<span class="lbl">Siguiente</span>
						<b title={next.precise ? undefined : 'Fecha aproximada'}>{next.precise ? '' : '≈ '}{countdown(Date.parse(next.net) - now)}</b>
					</p>
					<p class="what">{next.mission} · {next.provider || next.rocket}</p>
				{/if}
			</div>
		{/if}
		<Table>
			<thead>
				<tr><th>Hora</th><th class="l">Misión</th><th>Estado</th></tr>
			</thead>
			<tbody>
				{#each rows as l (l.id)}
					<tr>
						<td class="when">
							{dm(l.net)}<small>{l.precise ? hm(l.net) : 'aprox.'}</small>
						</td>
						<td class="m l">
							{#if l.url}
								<a class="name" href={l.url} target="_blank" rel="noopener" title={l.webcast ? 'Webcast' : 'Información de la misión'}>{l.mission}</a>
							{:else}
								<span class="name">{l.mission}</span>
							{/if}
							<small>{detail(l)}{l.webcast ? ' · webcast' : ''}</small>
						</td>
						<td class="st" class:go={l.status === 'Go'} class:on={started(l)} title={l.statusName || undefined}>
							{started(l) ? 'en curso' : l.status}
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	{/if}
	{#snippet note()}
		Fuente: The Space Devs (Launch Library 2)
		{#if ds}· <Updated at={ds.data.asOf} source="launches" />{/if}
		{#if ds?.data.limited}· límite de peticiones: copia anterior{/if}
	{/snippet}
</Panel>

<style>
	.count {
		padding: var(--row-y) var(--pad-x);
		border-bottom: var(--border);
	}

	.count p {
		margin: 0;
		display: flex;
		align-items: baseline;
		gap: var(--sp-10);
		min-width: 0;
	}

	.lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.live .lbl {
		color: var(--amber);
	}

	b {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
		color: var(--fg);
	}

	.what {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
		overflow-wrap: anywhere;
	}

	td {
		vertical-align: top;
	}

	small {
		display: block;
		color: var(--faint);
		font-size: var(--fs-xs);
	}

	.when {
		color: var(--muted);
	}

	/* La misión y su detalle pueden ocupar dos líneas: así la tabla cabe en el móvil sin desplazarse. */
	.m {
		width: 100%;
		white-space: normal;
	}

	.m small {
		font-family: var(--sans);
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}

	a.name {
		color: var(--fg);
		text-decoration: none;
	}

	a.name:hover {
		color: var(--amber);
	}

	.name {
		overflow-wrap: anywhere;
	}

	/* Estado discreto: gris; «Go» un poco más claro y «en curso» en ámbar. */
	.st {
		color: var(--faint);
		font-size: var(--fs-xxs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	.st.go {
		color: var(--muted);
	}

	.st.on {
		color: var(--amber);
	}
</style>

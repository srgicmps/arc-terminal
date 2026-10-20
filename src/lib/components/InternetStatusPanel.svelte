<!--
	Panel «Estado de internet» (TECH): un punto verde, ámbar o rojo por servicio (Cloudflare, AWS, Google Cloud,
	Microsoft 365, GitHub, OpenAI, Anthropic…) y su incidencia activa, si la hay. Carga él solo sus datos
	(static/data/statuspage.json), como LaunchesPanel.
-->
<script lang="ts">
	import { asset } from '$app/paths';
	import type { Dataset } from '#lib/data.ts';
	import { when } from '#lib/format.ts';
	import { activeIncident, label, sortServices, tone, type ServiceStatus } from '#lib/statuspage.ts';
	import Panel from './Panel.svelte';
	import Table from './ui/Table.svelte';
	import Updated from './Updated.svelte';

	// undefined: cargando · null: aún no hay archivo (en local, antes de `pnpm data`).
	let ds = $state<Dataset<ServiceStatus[]> | null | undefined>(undefined);
	// 0 al construir: así el HTML estático y el del navegador coinciden («hace 5 min» solo en el navegador).
	let now = $state(0);

	// $effect solo corre en el navegador (como onMounted en Vue). Se pide a /data/statuspage.json y no va
	// dentro del código: así un cambio de datos no cambia el nombre de los archivos de la build.
	$effect(() => {
		now = Date.now();
		fetch(asset('data/statuspage.json' as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<Dataset<ServiceStatus[]>>) : null))
			.then((d) => (ds = d))
			.catch(() => (ds = null));
	});

	const services = $derived(sortServices(ds?.data ?? []));
	const down = $derived(services.filter((s) => tone(s.indicator) !== 'ok').length);
</script>

<Panel title="Estado de internet" meta={down ? `${down} con incidencias` : 'Todo operativo'}>
	{#if ds === undefined}
		<p class="empty">Cargando…</p>
	{:else if !services.length}
		<p class="empty">Sin datos de las páginas de estado.</p>
	{:else}
		<Table>
			<thead>
				<tr><th>Servicio</th><th class="l">Estado</th></tr>
			</thead>
			<tbody>
				{#each services as s (s.id)}
					{@const t = tone(s.indicator)}
					{@const i = activeIncident(s)}
					<tr>
						<td class="svc">
							<i class="dot {t}" aria-hidden="true"></i>
							<a class="name" href={s.page} target="_blank" rel="noopener">{s.name}</a>
						</td>
						<td class="l st">
							<span class={t}>{label(s.indicator)}</span>
							{#if s.stale}<span class="mut" title="Esta pasada no se pudo leer: es el estado anterior"> · sin actualizar</span>{/if}
							{#if i}
								<small>
									<a href={i.url} target="_blank" rel="noopener">{i.name}</a>
									{#if i.updated}<span class="mut"> · {when(i.updated, now)}</span>{/if}
								</small>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</Table>
	{/if}
	{#snippet note()}
		Fuente: páginas de estado de cada servicio
		{#if ds}· <Updated at={ds.fetchedAt} source="statuspage" />{/if}
	{/snippet}
</Panel>

<style>
	td {
		vertical-align: top;
	}

	.svc {
		white-space: nowrap;
	}

	/* Punto de estado: verde, ámbar o rojo, como las pasadas de STATUS. */
	.dot {
		display: inline-block;
		width: var(--sp-6);
		height: var(--sp-6);
		margin-right: var(--sp-6);
		border-radius: 50%;
		vertical-align: middle;
		background: var(--up);
	}

	.dot.warn {
		background: var(--amber);
	}

	.dot.bad {
		background: var(--down);
	}

	a {
		color: var(--fg);
		text-decoration: none;
	}

	a:hover {
		color: var(--amber);
	}

	.st {
		width: 100%;
		white-space: normal;
		color: var(--muted);
	}

	.st .warn {
		color: var(--amber);
	}

	.st .bad {
		color: var(--down);
	}

	small {
		display: block;
		font-family: var(--sans);
		font-size: var(--fs-s);
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}

	small a {
		color: var(--muted);
	}
</style>

<!--
	«Act. hace 5 min»: cuándo se descargaron los datos de una fuente.
	Con `source` (el nombre del JSON, p. ej. "ecb"), si los datos llevan más del doble de lo normal sin
	actualizarse, la hora se atenúa y aparece un «hace 6 h» en ámbar tenue.
-->
<script module lang="ts">
	// Esta parte se ejecuta una sola vez y la comparten todos los <Updated> (como un composable de Vue
	// con el estado fuera de la función): status.json se pide una vez, solo si alguien lo necesita.
	// Se descarga de /data/status.json (como bardata.svelte.ts) y no va dentro del código: cambia en cada
	// pasada de datos y, empaquetado, cambiaba el nombre de ~40 archivos de la build en cada publicación
	// (y el service worker los volvía a bajar). Sin conexión, lo da la copia que guarda el service worker.
	import { asset } from '$app/paths';
	import type { Dataset, SourceStatus } from '#lib/data.ts';

	const maxAge: Record<string, number> = $state({});
	let requested = false;

	function loadStatus() {
		if (requested) return;
		requested = true;
		fetch(asset('data/status.json' as Parameters<typeof asset>[0]))
			.then((res) => (res.ok ? (res.json() as Promise<Dataset<SourceStatus[]>>) : null))
			.then((status) => {
				for (const s of status?.data ?? []) if (s.maxAgeMinutes) maxAge[s.name] = s.maxAgeMinutes;
			})
			// Sin el archivo (en local, antes de `pnpm data`) la hora sale como siempre, sin atenuar.
			.catch(() => {});
	}
</script>

<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { dm, hm, when } from '#lib/format.ts';
	import { ageMinutes, ago, staleAfter } from '#lib/freshness.ts';

	let { at, source }: { at: string | null | undefined; source?: string } = $props();

	// $effect solo corre en el navegador (como onMounted), así que el HTML generado no cambia.
	$effect(() => {
		if (source) loadStatus();
	});

	// Como computed() en Vue: se recalcula cuando cambia el reloj compartido, sin timers propios.
	const age = $derived(ageMinutes(at, clock.now));
	const limit = $derived(staleAfter(source ? maxAge[source] : undefined));
	const stale = $derived(age !== null && limit !== null && age > limit);
</script>

{#if at}
	{#if stale && age !== null}
		<span class="stale" title="Datos sin actualizar desde {dm(at)} {hm(at)}">
			<span class="time">Act. {dm(at)} {hm(at)}</span> <span class="ago">{ago(age)}</span>
		</span>
	{:else}
		<span>Act. {when(at, clock.now)}</span>
	{/if}
{/if}

<style>
	.stale {
		cursor: help;
	}
	/* Apagados, pero legibles (4,5:1): con opacity bajaban de 2,2:1 y 3:1. */
	.time {
		color: var(--faint);
	}
	.ago {
		color: var(--amber-dim);
	}
</style>

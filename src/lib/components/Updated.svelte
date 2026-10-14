<!--
	«Act. hace 5 min»: cuándo se descargaron los datos de una fuente.
	Con `source` (el nombre del JSON, p. ej. "ecb"), si los datos llevan más del doble de lo normal sin
	actualizarse, la hora se atenúa y aparece un «hace 6 h» en ámbar tenue.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { dm, hm, when } from '#lib/format.ts';
	import { ageMinutes, ago, staleAfter } from '#lib/freshness.ts';

	let { at, source }: { at: string | null | undefined; source?: string } = $props();

	// Como computed() en Vue: se recalcula cuando cambia el reloj compartido (cada 30 s), sin timers propios.
	const age = $derived(ageMinutes(at, clock.now));
	const limit = $derived(staleAfter(source));
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
	.time {
		opacity: 0.55;
	}
	.ago {
		color: var(--amber);
		opacity: 0.7;
	}
</style>

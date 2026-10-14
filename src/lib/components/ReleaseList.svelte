<!-- Últimas versiones estables de unas herramientas: nombre, fecha y versión con enlace a las notas.
     Lo publicado en los últimos 7 días sale en ámbar. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { dm } from '#lib/format.ts';
	import type { Release } from '#lib/types.ts';

	let { items }: { items: Release[] } = $props();

	const WEEK = 7 * 24 * 3600_000;
	// clock.now vale 0 al construir: así nada sale en ámbar en el HTML estático y luego se ajusta.
	const recent = (r: Release) => !!clock.now && !!r.time && clock.now - Date.parse(r.time) < WEEK;
</script>

{#if items.length}
	<ul class="mini">
		{#each items as r (r.repo)}
			<li class:new={recent(r)}>
				<span class="l">
					{r.name}
					<small>{r.time ? dm(r.time) : 'sin fecha'} · {r.repo}</small>
				</span>
				<a href={r.url} target="_blank" rel="noopener" title="Notas de la versión {r.version}"><b>{r.version}</b></a>
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<style>
	.new b,
	.new .l {
		color: var(--amber);
	}
</style>

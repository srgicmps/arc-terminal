<!--
	Barcos en cada puerto o estrecho (AIS): nombre y tipo, estado y velocidad, y hace cuánto se le oyó.
	Primero los puertos con barcos; los que no tienen ninguno van juntos en una línea al final.
-->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, when } from '#lib/format.ts';
	import type { PortShips } from '#lib/types.ts';

	let { ports }: { ports: PortShips[] } = $props();

	const busy = $derived(ports.filter((p) => p.total).sort((a, b) => b.total - a.total));
	const quiet = $derived(ports.filter((p) => !p.total).map((p) => p.name));
</script>

<div class="scroll">
	<table class="t">
		<thead>
			<tr><th>Barco</th><th class="l">Estado</th><th>Visto</th></tr>
		</thead>
		{#each busy as port (port.id)}
			<tbody>
				<tr>
					<th class="l" colspan="3">
						{port.name} · {port.total} {port.total === 1 ? 'barco' : 'barcos'}{port.total > port.ships.length ? ` (los ${port.ships.length} últimos)` : ''}
					</th>
				</tr>
				{#each port.ships as s (s.mmsi)}
					<tr>
						<td class="name">{s.name || `MMSI ${s.mmsi}`}{#if s.type || s.destination}<span class="sub">{[s.type, s.destination && `→ ${s.destination}`].filter(Boolean).join(' ')}</span>{/if}</td>
						<td class="l">{s.status}{#if s.speed}<span class="sub">{nf(s.speed, 1)} nudos</span>{/if}</td>
						<td class="mut">{when(s.time, clock.now)}</td>
					</tr>
				{/each}
			</tbody>
		{/each}
		{#if quiet.length}
			<tbody>
				<tr><td class="mut l quiet" colspan="3">{quiet.join(', ')}: sin barcos detectados; cobertura AIS voluntaria.</td></tr>
			</tbody>
		{/if}
	</table>
</div>

<style>
	/* La línea de los puertos sin barcos puede ocupar varias líneas en el móvil. */
	.quiet {
		white-space: normal;
	}
</style>

<!-- Barcos en cada puerto (AIS): nombre y tipo, estado y velocidad, y hace cuánto se le oyó. -->
<script lang="ts">
	import { clock } from '#lib/clock.svelte.ts';
	import { nf, when } from '#lib/format.ts';
	import type { PortShips } from '#lib/types.ts';

	let { ports }: { ports: PortShips[] } = $props();
</script>

<div class="scroll">
	<table class="t">
		<thead>
			<tr><th>Barco</th><th class="l">Estado</th><th>Nudos</th><th>Visto</th></tr>
		</thead>
		{#each ports as port (port.id)}
			<tbody>
				<tr><th class="l" colspan="4">{port.name} · {port.ships.length} {port.ships.length === 1 ? 'barco' : 'barcos'}</th></tr>
				{#each port.ships as s (s.mmsi)}
					<tr>
						<td class="name">{s.name || `MMSI ${s.mmsi}`}{#if s.type || s.destination}<span class="sub">{[s.type, s.destination && `→ ${s.destination}`].filter(Boolean).join(' ')}</span>{/if}</td>
						<td class="l">{s.status}</td>
						<td>{s.speed === null ? '—' : nf(s.speed, 1)}</td>
						<td class="mut">{when(s.time, clock.now)}</td>
					</tr>
				{:else}
					<tr><td class="mut" colspan="4">Ningún barco ahora mismo.</td></tr>
				{/each}
			</tbody>
		{/each}
	</table>
</div>

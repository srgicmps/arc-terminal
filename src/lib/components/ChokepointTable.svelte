<!-- Pasos marítimos clave: tránsitos diarios (media de 7 días), cambio frente al año anterior y 90 días. -->
<script lang="ts">
	import { dm, nf, signed, trend } from '#lib/format.ts';
	import type { Chokepoint } from '#lib/types.ts';
	import Spark from './Spark.svelte';

	let { items }: { items: Chokepoint[] } = $props();
</script>

{#if items.length}
	<div class="scroll">
		<table class="t">
			<thead>
				<tr><th>Paso</th><th title="Barcos al día, media de 7 días">Barcos</th><th title="Frente a los mismos 7 días del año anterior">1 año</th><th>90 d</th></tr>
			</thead>
			<tbody>
				{#each items as c (c.id)}
					<tr>
						<td class="name">{c.name}<span class="sub">{dm(`${c.last}T12:00:00Z`)}</span></td>
						<td>{nf(c.avg7, 0)}</td>
						<td class={trend(c.change)}>{c.change === null ? '—' : `${signed(c.change, 1)} %`}</td>
						<td><Spark values={c.spark} /></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

<!-- Crisis y desastres activos de ReliefWeb: nombre con enlace a la ficha, tipo, país y fecha de inicio. -->
<script lang="ts">
	import { dm } from '#lib/format.ts';
	import { madridNow } from '#lib/power.ts';
	import type { Disaster } from '#lib/types.ts';

	let { items }: { items: Disaster[] } = $props();

	const TYPE: Record<string, string> = {
		Flood: 'Inundación',
		'Flash Flood': 'Riada',
		'Tropical Cyclone': 'Ciclón tropical',
		'Extratropical Cyclone': 'Ciclón extratropical',
		'Storm Surge': 'Marejada ciclónica',
		'Severe Local Storm': 'Tormenta fuerte',
		Epidemic: 'Epidemia',
		Earthquake: 'Terremoto',
		Tsunami: 'Tsunami',
		Volcano: 'Volcán',
		Drought: 'Sequía',
		'Cold Wave': 'Ola de frío',
		'Heat Wave': 'Ola de calor',
		'Land Slide': 'Deslizamiento',
		'Mud Slide': 'Alud de lodo',
		'Snow Avalanche': 'Avalancha',
		'Wild Fire': 'Incendio forestal',
		Fire: 'Incendio',
		'Insect Infestation': 'Plaga',
		'Complex Emergency': 'Emergencia compleja',
		'Technological Disaster': 'Desastre tecnológico',
		Other: 'Otro'
	};
	/** Fecha con año si no es de este año (los dos, en hora de Madrid): hay crisis abiertas desde hace mucho. */
	const year = (t: number) => madridNow(t).day.slice(0, 4);
	const since = (iso: string) => {
		const y = year(Date.parse(iso));
		return y === year(Date.now()) ? dm(iso) : `${dm(iso)} ${y}`;
	};
</script>

{#if items.length}
	<ul class="mini">
		{#each items as d (d.id)}
			<li>
				<span class="l">
					<a href={d.url} target="_blank" rel="noopener">{d.name}</a>
					<small>{TYPE[d.type] ?? d.type}{d.country ? ` · ${d.country}` : ''}</small>
				</span>
				<b>{d.date ? since(d.date) : ''}</b>
			</li>
		{/each}
	</ul>
{:else}
	<p class="empty">Sin datos todavía.</p>
{/if}

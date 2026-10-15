<!--
	Panel «En casa» de AVISOS (F16 y F12): las horas baratas de la luz de mañana, el polen de mañana en tu sitio
	y la víspera de los resultados de tus valores. Recibe la configuración y el `set` de la vista.
-->
<script lang="ts">
	import Panel from './Panel.svelte';
	import Seg from './ui/Seg.svelte';
	import type { AlertConfig, Home } from '#lib/alertconfig.ts';

	let { config, set }: { config: AlertConfig; set: (patch: Partial<AlertConfig>) => void } = $props();

	const ROWS: { key: keyof Home; label: string }[] = [
		{ key: 'luz', label: 'Luz barata mañana' },
		{ key: 'pollen', label: 'Polen mañana' },
		{ key: 'results', label: 'Resultados mañana' }
	];
	const YESNO = [
		{ value: 'yes', label: 'Sí' },
		{ value: 'no', label: 'No' }
	];
	const on = $derived(ROWS.filter((r) => config.home[r.key]).length);
</script>

<Panel title="En casa" meta={on ? `${on} de ${ROWS.length}` : 'Apagados'}>
	<dl class="form">
		{#each ROWS as r (r.key)}
			<dt>{r.label}</dt>
			<dd>
				<Seg
					label={r.label}
					options={YESNO}
					bind:value={() => (config.home[r.key] ? 'yes' : 'no'), (v) => set({ home: { ...config.home, [r.key]: v === 'yes' } })}
				/>
			</dd>
		{/each}
	</dl>
	{#snippet note()}
		Luz: las 3 mejores franjas de 2 horas de mañana, cuando se publican (hacia las 21:00). Polen: si mañana llega a
		moderado o alto en tu sitio{config.brief.place ? ` (${config.brief.place.name})` : ''}; usa el de «Tu mañana»{config.brief
			.place
			? ''
			: ', que aún no has elegido'}. Resultados: la víspera, para tus valores. Fuera de tu silencio.
	{/snippet}
</Panel>

<style>
	.form {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--sp-6) var(--sp-12);
		align-items: center;
		margin: 0;
		padding: var(--row-y) var(--pad-x);
	}
	.form dt {
		color: var(--muted);
		font-size: var(--fs-s);
	}
	.form dd {
		margin: 0;
		min-width: 0;
	}
</style>

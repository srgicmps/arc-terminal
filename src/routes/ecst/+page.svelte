<script lang="ts">
	import G20Table from '#lib/components/G20Table.svelte';
	import Panel from '#lib/components/Panel.svelte';
	import Updated from '#lib/components/Updated.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<ViewHeader code="ECST" title="Las grandes economías" sub="FMI, BIS, BCE, Tesoro de EE. UU. y Ministerio de Finanzas de Japón" />

<div class="grid">
	<div class="col">
		<Panel title="G20 en cifras" meta="{data.year ?? 'Este año'} · % · pulsa una cabecera para ordenar">
			<G20Table rows={data.rows} />
			{#snippet note()}
				PIB, IPC, paro, deuda y saldo público: estimación del FMI para este año{data.edition ? ` (WEO de ${data.edition})` : ''}.
				Tipo oficial: BIS (los del euro, el del BCE). Bono a 10 años: media mensual del BCE para Alemania, Francia,
				Italia y España; último cierre para EE. UU. (Tesoro) y Japón (MOF). Sin dato, «—». · <Updated at={data.fetchedAt} source="imf" />
			{/snippet}
		</Panel>
	</div>
</div>

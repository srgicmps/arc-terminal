<!-- ESTILO: elegir la estética, con vista previa de cada una (src/lib/estilos.ts; el aspecto, en
	src/styles/estilos/). «ESTILO fósforo» llega con ?s=fósforo y se aplica al abrir. -->
<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import StylePicker from '#lib/components/StylePicker.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Note from '#lib/components/ui/Note.svelte';
	import { parseStyle } from '#lib/estilos.ts';
	import { READY } from '#lib/estilos-css.ts';
	import { setStyle, taste } from '#lib/taste.svelte.ts';

	$effect(() => {
		const wanted = parseStyle(page.url.searchParams.get('s'));
		if (wanted && READY.includes(wanted) && wanted !== taste.style) setStyle(wanted);
	});
</script>

<svelte:head><title>ESTILO · Arc Terminal</title></svelte:head>

<ViewHeader code="ESTILO" title="Estética" sub="Cambia el aspecto de toda la web" />

<div class="grid">
	<div class="col">
		<Panel title="Estética">
			<div class="pick"><StylePicker /></div>
			<Note>Se combina con el tema de día o de noche (◐), la densidad y el modo de HELP, «A tu gusto».</Note>
		</Panel>
	</div>
</div>

<style>
	.pick {
		padding: var(--sp-10) var(--pad-x);
	}
</style>

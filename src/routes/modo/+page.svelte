<!--
	MODO: elegir entre Sencillo y Terminal (src/lib/modo.ts). «MODO sencillo» en la barra llega como ?m=sencillo
	y cambia el modo nada más abrir la vista.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Panel from '#lib/components/Panel.svelte';
	import ViewHeader from '#lib/components/ViewHeader.svelte';
	import Seg from '#lib/components/ui/Seg.svelte';
	import { fold } from '#lib/simple.ts';
	import { modo, MODOS, setModo } from '#lib/modo.svelte.ts';

	// Como un watch de Vue sobre la URL: si trae ?m=, se aplica. En el navegador (la página se genera sin query).
	$effect(() => {
		const want = fold(page.url.searchParams.get('m') ?? '');
		if (want.startsWith('senc') || want === 'simple') setModo('sencillo');
		else if (want.startsWith('term') || want === 'experto') setModo('terminal');
	});
</script>

<ViewHeader code="MODO" title="Modo" sub="Cómo quieres ver Arc Terminal" />

<div class="grid">
	<Panel title="Modo">
		<div class="body">
			<Seg label="Modo" options={MODOS} bind:value={() => modo.value, setModo} />
			<dl>
				<dt>Sencillo</dt>
				<dd>Lo esencial de cada vista, con letra algo mayor y más aire. Los títulos van en español claro y, al tocar el ⓘ de un dato, te explica qué es, por qué importa y cómo leerlo.</dd>
				<dt>Terminal</dt>
				<dd>Todos los paneles, densos, al estilo Bloomberg. Para quien ya conoce los datos.</dd>
			</dl>
		</div>
	</Panel>
</div>

<style>
	.body {
		display: grid;
		gap: var(--sp-12);
		padding: var(--sp-12) var(--pad-x);
	}

	dl {
		margin: 0;
		display: grid;
		gap: var(--sp-4);
		font-family: var(--sans);
		font-size: var(--fs-m);
		line-height: var(--lh-text);
	}

	dt {
		color: var(--amber);
		font-weight: var(--fw-medium);
	}

	dd {
		margin: 0 0 var(--sp-8);
		color: var(--muted);
	}
</style>

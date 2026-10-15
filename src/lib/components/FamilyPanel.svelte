<!--
	Panel «Familia» de AVISOS (F15): tu nombre para los demás y si aceptas que te manden titulares por ntfy.
	Te llegan a tu canal de avisos, así que hace falta tenerlos activados.
-->
<script lang="ts">
	import Panel from './Panel.svelte';
	import Seg from './ui/Seg.svelte';
	import { family, loadFamily, saveFamily } from '#lib/family.svelte.ts';

	let name = $state('');
	let msg = $state('');

	$effect(() => {
		void loadFamily().then(() => (name = family.me.name));
	});

	async function save(accept: boolean) {
		const n = name.trim();
		if (!n) {
			msg = 'Escribe antes tu nombre.';
			return;
		}
		msg = (await saveFamily(n, accept)) ? 'Guardado' : 'No se ha podido guardar.';
	}
</script>

{#if family.phase === 'ready'}
	<Panel title="Familia" meta={family.me.accept ? 'Recibes' : 'No recibes'}>
		<form
			class="row"
			onsubmit={(e) => {
				e.preventDefault();
				void save(family.me.accept);
			}}
		>
			<label for="fam-name">Tu nombre</label>
			<input id="fam-name" bind:value={name} maxlength="40" placeholder="Así te verán" autocomplete="nickname" />
			<button type="submit">Guardar</button>
		</form>
		<div class="row">
			<span>Que te manden</span>
			<Seg
				label="Recibir titulares de la familia"
				options={[
					{ value: 'yes', label: 'Sí' },
					{ value: 'no', label: 'No' }
				]}
				bind:value={() => (family.me.accept ? 'yes' : 'no'), (v) => save(v === 'yes')}
			/>
		</div>
		{#snippet note()}
			Con tu nombre puedes mandar titulares con «Mandar» (debajo de cada uno). Si aceptas, los demás te los mandan
			a tu canal de avisos{family.reachable ? '' : ', que tienes apagado: actívalo arriba'}. Hasta 30 al día. {msg}
		{/snippet}
	</Panel>
{/if}

<style>
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--sp-8);
		align-items: center;
		padding: var(--row-y) var(--pad-x);
		font-size: var(--fs-s);
		color: var(--muted);
	}
	input {
		flex: 1 1 10em;
		min-width: 0;
		height: var(--control-h);
		background: var(--bg);
		color: var(--fg);
		border: var(--border);
		font: inherit;
		padding: 0 var(--sp-6);
	}
	button {
		height: var(--control-h);
		background: var(--bg);
		color: var(--fg);
		border: var(--border);
		font: inherit;
		padding: 0 var(--sp-10);
		cursor: pointer;
	}
</style>

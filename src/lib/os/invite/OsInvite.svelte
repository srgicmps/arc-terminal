<!--
	Invitación al Modo OS en el primer paso de la Bienvenida: vista previa, «Probar el Modo OS» (lo abre ya, sin
	cambiar nada) y «Empezar siempre en el Modo OS» (lo deja por defecto; al terminar la Bienvenida se entra en /os).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { osMode, setOsMode } from '../mode.svelte.ts';
	import OsPreview from './OsPreview.svelte';

	const uid = $props.id();
	const always = $derived(osMode.value === 'os');
</script>

<section class="inv" aria-labelledby="{uid}-t">
	<OsPreview />
	<div class="txt">
		<h3 id="{uid}-t">Nuevo: prueba el Modo OS</h3>
		<p>Arc como un sistema operativo: ventanas que se mueven, menú Inicio, widgets y una consola. En el móvil, una pantalla de inicio con tus apps. El Terminal clásico sigue a un toque.</p>
		<div class="row">
			<button type="button" class="go" onclick={() => goto(resolve('/os' as '/'))}>Probar el Modo OS</button>
			<label class="chk">
				<input type="checkbox" checked={always} onchange={(e) => setOsMode(e.currentTarget.checked ? 'os' : 'clasico')} />
				Empezar siempre en el Modo OS
			</label>
		</div>
	</div>
</section>

<style>
	.inv {
		display: flex;
		gap: var(--sp-16);
		align-items: center;
		margin: 0 0 var(--sp-20);
		padding: var(--sp-12);
		border: var(--border);
		border-radius: var(--radius);
		background: var(--panel);
	}
	.inv :global(.pv) {
		flex: 0 0 220px;
	}
	.txt {
		display: flex;
		flex-direction: column;
		gap: var(--sp-6);
	}
	h3 {
		margin: 0;
		font-family: var(--title-font);
		font-size: var(--fs-l);
		color: var(--amber);
	}
	p {
		margin: 0;
		color: var(--muted);
		font-size: var(--fs-s);
		line-height: var(--lh-text);
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--sp-8) var(--sp-16);
	}
	.go {
		height: var(--control-h);
		padding: 0 var(--sp-12);
		background: var(--amber);
		border: var(--hair) solid var(--amber);
		border-radius: var(--radius-s);
		color: var(--on-amber);
		font: inherit;
		cursor: pointer;
	}
	.chk {
		display: flex;
		align-items: center;
		gap: var(--sp-6);
		min-height: var(--control-h);
		font-size: var(--fs-s);
		cursor: pointer;
	}
	@media (max-width: 720px) {
		.inv {
			flex-direction: column;
			align-items: stretch;
		}
		.inv :global(.pv) {
			flex: none;
			max-width: none;
		}
	}
</style>

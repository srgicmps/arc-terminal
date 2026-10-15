<!--
	Pantalla de inicio de Arc OS: el logo y una barra fina de progreso, menos de un segundo, la primera vez del día.
	Se salta con un clic o cualquier tecla. Con prefers-reduced-motion, apenas un instante y sin animación.
-->
<script lang="ts">
	import { overlay } from '../focus.ts';
	import Logo from '#lib/components/Logo.svelte';
	import { BOOT_STEPS } from './boot.ts';

	let { ondone }: { ondone: () => void } = $props();

	let step = $state(0);
	let el = $state<HTMLDivElement>();

	$effect(() => {
		el?.focus();
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		const each = reduced ? 80 : 200; // unos 0,8 s en total
		const id = setInterval(() => {
			if (step < BOOT_STEPS.length - 1) step++;
			else (clearInterval(id), setTimeout(ondone, each));
		}, each);
		return () => clearInterval(id);
	});

	const pct = $derived(Math.round(((step + 1) / BOOT_STEPS.length) * 100));
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="boot"
	role="dialog"
	aria-modal="true"
	aria-label="Arrancando Arc OS"
	tabindex="-1"
	bind:this={el}
	use:overlay
	onclick={ondone}
	onkeydown={(e) => (e.preventDefault(), ondone())}
>
	<Logo size="var(--os-logo-big)" />
	<p class="name">Arc OS</p>
	<div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={pct}>
		<i style:width="{pct}%"></i>
	</div>
	<p class="step mut" aria-live="polite">{BOOT_STEPS[step]}</p>
	<p class="skip mut">Toca o pulsa una tecla para saltar</p>
</div>

<style>
	.boot {
		position: fixed;
		inset: 0;
		z-index: var(--z-system);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-12);
		background: var(--os-sys-bg);
		color: var(--fg);
		outline: none;
		cursor: default;
		animation: fade var(--dur-fast) ease-out;
	}

	.name {
		margin: 0;
		font-family: var(--mono);
		font-size: var(--fs-l);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.bar {
		width: var(--os-boot-bar);
		height: var(--hair);
		background: var(--line);
	}

	.bar i {
		display: block;
		height: 100%;
		background: var(--amber);
		transition: width 180ms ease-out;
	}

	.step,
	.skip {
		margin: 0;
		font-size: var(--fs-xs);
		font-family: var(--mono);
	}

	.skip {
		position: absolute;
		bottom: var(--sp-24);
		opacity: 0.7;
	}

	@keyframes fade {
		from {
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.boot {
			animation: none;
		}
		.bar i {
			transition: none;
		}
	}
</style>

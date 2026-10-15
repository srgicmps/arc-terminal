<!--
	Pantalla de bloqueo de Arc OS: la hora en grande, la fecha, un saludo y el resumen de avisos sin leer (del
	centro de notificaciones de la shell). Se desbloquea con un clic o cualquier tecla. No protege nada: es la
	«portada» del sistema; la cuenta ya la protege Cloudflare Access.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { refreshNotices, shell } from '../shell/shell.svelte.ts';
	import { greeting, lockSummary } from './boot.ts';

	let { onunlock }: { onunlock: () => void } = $props();

	let now = $state(new Date());
	let el = $state<HTMLDivElement>();
	let leaving = $state(false);

	$effect(() => {
		el?.focus();
		// Si la shell aún no ha pedido los avisos (el centro de notificaciones no está montado), se piden aquí.
		untrack(() => !shell.notices.length && refreshNotices());
		const id = setInterval(() => (now = new Date()), 1000);
		return () => clearInterval(id);
	});

	const time = $derived(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
	const date = $derived(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
	const sum = $derived(lockSummary(shell.notices, shell.seen));

	function go() {
		if (leaving) return;
		const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduced) return onunlock();
		leaving = true;
		setTimeout(onunlock, 220);
	}
	function key(e: KeyboardEvent) {
		// Las teclas modificadoras solas no desbloquean (Alt para cambiar de ventana, por ejemplo).
		if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
		e.preventDefault();
		e.stopPropagation();
		go();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="lock"
	class:leaving
	role="dialog"
	aria-modal="true"
	aria-label="Pantalla de bloqueo. Pulsa una tecla para entrar"
	tabindex="-1"
	bind:this={el}
	onclick={go}
	onkeydown={key}
>
	<div class="when">
		<p class="time">{time}</p>
		<p class="date">{date}</p>
	</div>
	<div class="sum">
		<p class="hi">{greeting(now.getHours())}. <span class="mut">{sum.headline}</span></p>
		{#if sum.items.length}
			<ul>
				{#each sum.items as n (n.id)}
					<li><span class="k">{n.kind === 'aviso' ? 'Aviso' : 'Novedad'}</span> {n.title}</li>
				{/each}
			</ul>
		{/if}
	</div>
	<p class="hint mut">Toca o pulsa una tecla para entrar</p>
</div>

<style>
	.lock {
		position: fixed;
		inset: 0;
		z-index: var(--z-system);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--sp-24);
		padding: var(--sp-24) var(--sp-16);
		background: var(--os-sys-bg);
		background-image: var(--bg-image);
		color: var(--fg);
		outline: none;
		cursor: default;
		text-align: center;
		transition:
			opacity 200ms ease-out,
			transform 200ms ease-out;
	}

	.lock.leaving {
		opacity: 0;
		transform: translateY(-2%);
	}

	p {
		margin: 0;
	}

	.time {
		font-family: var(--mono);
		font-size: var(--fs-clock);
		font-weight: var(--fw-regular);
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	.date {
		margin-top: var(--sp-8);
		font-family: var(--sans);
		font-size: var(--fs-l);
		color: var(--muted);
	}

	.date::first-letter {
		text-transform: uppercase;
	}

	.sum {
		max-width: 52ch;
		font-family: var(--sans);
		font-size: var(--fs-m);
	}

	ul {
		margin: var(--sp-10) 0 0;
		padding: 0;
		list-style: none;
		text-align: left;
		border-top: var(--border);
	}

	li {
		padding: var(--sp-6) 0;
		border-bottom: var(--border);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.k {
		font-family: var(--mono);
		font-size: var(--fs-xxs);
		color: var(--amber);
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		margin-right: var(--sp-6);
	}

	.hint {
		position: absolute;
		bottom: var(--sp-24);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	@media (prefers-reduced-motion: reduce) {
		.lock {
			transition: none;
		}
	}
</style>

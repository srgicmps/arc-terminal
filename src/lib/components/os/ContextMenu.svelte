<!--
	Menú contextual del Modo OS (clic derecho): lo usan las ventanas y, en el escritorio, OS 2. Se coloca donde se
	pide y se recoloca para no salirse de la pantalla. Teclado: flechas, Inicio/Fin, Intro y Esc; clic fuera cierra.
	Uso: <ContextMenu x={e.clientX} y={e.clientY} items={[{ label: 'Cerrar', kbd: 'Alt+W', run: … }, 'sep']} onclose={…} />
-->
<script lang="ts" module>
	export interface MenuItem {
		label: string;
		run: () => void;
		/** Atajo que se enseña a la derecha («Alt+W»). */
		kbd?: string;
		disabled?: boolean;
		/** Opción con casilla (✓ si está marcada). */
		checked?: boolean;
	}
	/** 'sep': una línea entre grupos. */
	export type MenuEntry = MenuItem | 'sep';
</script>

<script lang="ts">
	let { x, y, items, label = 'Menú', onclose }: { x: number; y: number; items: MenuEntry[]; label?: string; onclose: () => void } = $props();

	let menu = $state<HTMLDivElement>();
	let pos = $state({ x: 0, y: 0 });

	// Como onMounted: se coloca sin salirse de la ventana del navegador y el foco va a la primera opción.
	$effect(() => {
		if (!menu) return;
		const r = menu.getBoundingClientRect();
		pos = { x: Math.max(0, Math.min(x, innerWidth - r.width)), y: Math.max(0, Math.min(y, innerHeight - r.height)) };
		buttons()[0]?.focus();
	});

	const buttons = () => [...(menu?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];

	function onkeydown(e: KeyboardEvent) {
		const list = buttons();
		const i = list.indexOf(document.activeElement as HTMLButtonElement);
		const go = (n: number) => list[(n + list.length) % list.length]?.focus();
		if (e.key === 'Escape') onclose();
		else if (e.key === 'ArrowDown') go(i + 1);
		else if (e.key === 'ArrowUp') go(i - 1);
		else if (e.key === 'Home') go(0);
		else if (e.key === 'End') go(list.length - 1);
		else if (e.key === 'Tab') onclose();
		else return;
		e.preventDefault();
		e.stopPropagation();
	}

	function pick(item: MenuItem) {
		onclose();
		item.run();
	}

	// Clic fuera (también dentro de un iframe: la ventana pierde el foco) o cambio de tamaño: se cierra.
	$effect(() => {
		const out = (e: PointerEvent) => !menu?.contains(e.target as Node) && onclose();
		const blur = () => onclose();
		addEventListener('pointerdown', out, true);
		addEventListener('blur', blur);
		addEventListener('resize', blur);
		return () => {
			removeEventListener('pointerdown', out, true);
			removeEventListener('blur', blur);
			removeEventListener('resize', blur);
		};
	});
</script>

<div class="menu" data-ui="os-menu" role="menu" aria-label={label} tabindex="-1" bind:this={menu} style:left="{pos.x}px" style:top="{pos.y}px" {onkeydown} oncontextmenu={(e) => e.preventDefault()}>
	{#each items as item, i (i)}
		{#if item === 'sep'}
			<div class="sep" role="separator"></div>
		{:else}
			<button
				type="button"
				role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
				aria-checked={item.checked}
				disabled={item.disabled}
				onclick={() => pick(item)}
			>
				<span class="check" aria-hidden="true">{item.checked ? '✓' : ''}</span>
				<span class="label">{item.label}</span>
				{#if item.kbd}<kbd>{item.kbd}</kbd>{/if}
			</button>
		{/if}
	{/each}
</div>

<style>
	.menu {
		position: fixed;
		z-index: var(--z-modal);
		min-width: 200px;
		padding: var(--sp-4) 0;
		background: var(--os-menu-bg);
		border: var(--os-win-edge);
		border-radius: var(--os-menu-radius);
		box-shadow: var(--os-menu-shadow);
		font-size: var(--fs-s);
		backdrop-filter: var(--panel-blur);
	}

	button {
		display: flex;
		align-items: center;
		gap: var(--sp-8);
		width: 100%;
		min-height: var(--control-h);
		padding: 0 var(--sp-12) 0 var(--sp-8);
		border: 0;
		background: none;
		color: var(--fg);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	button:focus-visible {
		background: var(--amber-soft);
		outline: none;
	}
	@media (hover: hover) {
		button:hover:not(:disabled) {
			background: var(--amber-soft);
			outline: none;
		}
	}

	button:disabled {
		color: var(--faint);
		cursor: default;
	}

	.check {
		width: 1ch;
		color: var(--amber);
	}

	.label {
		flex: 1;
	}

	kbd {
		color: var(--muted);
		font-family: var(--mono);
		font-size: var(--fs-xs);
	}

	.sep {
		height: var(--hair);
		margin: var(--sp-4) 0;
		background: var(--line);
	}
</style>

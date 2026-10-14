<!--
	Tira de cifras clave (4–6) arriba de una vista: etiqueta, cifra, variación opcional y detalle.
	Todas en una fila; en el móvil, de dos en dos. Cada cifra puede llevar un enlace (al panel o a la serie).
	Para 2 o 3 cifras grandes con más texto, mejor <Tiles> + <Tile>.
-->
<script lang="ts" module>
	export interface Kpi {
		label: string;
		value: string;
		/** Color de la cifra, como en <Tile>. */
		tone?: 'up' | 'down' | 'flat' | 'mut';
		/** Variación, con su color: «+0,2 pp». */
		change?: { text: string; tone: 'up' | 'down' | 'flat' };
		/** Detalle en gris: periodo, fuente… */
		sub?: string;
		href?: string;
	}
</script>

<script lang="ts">
	let { items }: { items: Kpi[] } = $props();
</script>

{#if items.length}
	<div class="strip" style:--n={items.length}>
		{#each items as k, i (i)}
			<svelte:element this={k.href ? 'a' : 'div'} class="kpi" href={k.href}>
				<span class="lbl">{k.label}</span>
				<b class={k.tone}>{k.value}</b>
				{#if k.change || k.sub}
					<span class="sub">
						{#if k.change}<span class={k.change.tone}>{k.change.text}</span>{/if}{#if k.change && k.sub}{' · '}{/if}{k.sub ?? ''}
					</span>
				{/if}
			</svelte:element>
		{/each}
	</div>
{/if}

<style>
	.strip {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		gap: var(--hair);
		background: var(--line);
		border: var(--border);
		/* La línea de abajo la pone el panel que va debajo: así no queda doble. */
		border-bottom: 0;
	}

	.kpi {
		display: flex;
		flex-direction: column;
		gap: var(--sp-3);
		min-width: 0;
		padding: var(--sp-10) var(--sp-12);
		background: var(--panel);
		color: inherit;
		text-decoration: none;
	}

	a.kpi:hover .lbl {
		color: var(--amber);
	}

	.lbl {
		color: var(--muted);
		font-size: var(--fs-xs);
		letter-spacing: var(--track-code);
		text-transform: uppercase;
	}

	b {
		font-size: var(--fs-xl);
		font-weight: var(--fw-medium);
	}

	.sub {
		color: var(--muted);
		font-family: var(--sans);
		font-size: var(--fs-s);
	}

	@media (max-width: 720px) {
		.strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		/* Con un número impar, la última ocupa la fila entera: sin hueco. */
		.kpi:last-child:nth-child(odd) {
			grid-column: 1 / -1;
		}
	}
</style>

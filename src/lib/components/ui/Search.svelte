<!--
	Buscador común (NEWS, BOE): un campo con ✕ para vaciarlo. Escape también lo vacía.
	Busca palabras sueltas y sin tildes: filtra con queryWords + hasWords de #lib/search.ts.
	El contador «N de M» va en el meta del panel de resultados, no aquí.
	Uso: <Search label="Buscar en los titulares" placeholder="Buscar: Lagarde…" bind:value={query} />
-->
<script lang="ts">
	interface Props {
		label: string;
		placeholder?: string;
		value: string;
	}

	let { label, placeholder = '', value = $bindable() }: Props = $props();
	let input: HTMLInputElement;

	function clear() {
		value = '';
		input.focus();
	}
</script>

<div class="search">
	<input
		bind:this={input}
		type="search"
		bind:value
		{placeholder}
		aria-label={label}
		enterkeyhint="search"
		onkeydown={(e) => {
			if (e.key === 'Escape' && value) {
				e.preventDefault();
				value = '';
			}
		}}
	/>
	{#if value}
		<button type="button" class="clear" onclick={clear} aria-label="Vaciar la búsqueda">✕</button>
	{/if}
</div>

<style>
	.search {
		position: relative;
		display: flex;
		flex: 1 1 280px;
	}

	input {
		flex: 1;
		min-width: 0;
		height: var(--control-h);
		padding: 0 var(--control-h) 0 var(--sp-10);
		background: var(--panel);
		border: var(--border);
		border-radius: var(--radius-s);
		font-family: var(--sans);
		font-size: var(--fs-l);
	}

	/* El ✕ propio sustituye al del navegador (solo lo tienen Chrome y Safari). */
	input::-webkit-search-cancel-button {
		appearance: none;
	}

	input:focus {
		outline: none;
		border-color: var(--amber);
	}

	.clear {
		position: absolute;
		top: 0;
		right: 0;
		width: var(--control-h);
		height: var(--control-h);
		border: 0;
		background: none;
		color: var(--faint);
		font-size: var(--fs-s);
		cursor: pointer;
	}

	.clear:focus-visible {
		color: var(--amber);
	}

	@media (hover: hover) {
		.clear:hover {
			color: var(--amber);
		}
	}
</style>

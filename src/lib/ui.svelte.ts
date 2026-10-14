// Estado de la interfaz compartido entre componentes (como un store mínimo de Pinia en Vue).

export const ui = $state({
	/** En el móvil, la barra de comandos abierta como hoja desde abajo. */
	sheet: false
});

// Estado de la Calculadora fuera de los componentes (como un store de Pinia): así no se pierde al cambiar de
// pestaña (Normal, Financiera, Divisas desmontan su componente) ni al cerrar la ventana y volver a abrirla.
// Solo dura mientras la página esté abierta: no se guarda en el navegador ni en la cuenta.

export const calc = $state({
	tab: 'normal' as 'normal' | 'fin' | 'fx',
	expr: '',
	/** La cuenta en pantalla es un resultado recién salido de «=». */
	fresh: false,
	/** value: el resultado exacto (plainResult) para seguir con él; result: cómo se lee. */
	history: [] as { expr: string; result: string; value: string }[],
	fin: { mode: 'comp' as 'comp' | 'loan' | 'cagr', capital: '10.000', rate: '4', years: '10', monthly: '100', end: '15.000' },
	fx: { amount: '100', from: 'EUR', to: 'USD' }
});

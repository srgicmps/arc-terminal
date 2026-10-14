// Por qué no hay datos de una fuente, según status.json. Antes, CAL y ECO decían siempre «Falta la clave»
// cuando no encontraban el archivo, aunque la clave estuviera puesta y la causa fuera otra.
import type { SourceStatus } from './data.ts';

export function missingNote(status: SourceStatus[] | undefined, name: string): string {
	const s = status?.find((r) => r.name === name);
	if (s?.state === 'off') return `Falta la clave ${s.requires} en GitHub Secrets.`;
	if (s?.state === 'error') return `No se han podido descargar los datos${s.error ? ` (${s.error})` : ''}. Se reintenta en la próxima pasada.`;
	return 'Sin datos todavía.';
}

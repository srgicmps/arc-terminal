// Lugar de un terremoto del USGS en español: «98 km SSW of Neiafu, Tonga» → «98 km al SSO de Neiafu, Tonga».
// Solo cambia la parte en inglés; los nombres propios se quedan como vienen.

/** Rumbos en inglés → español (W es O, oeste). */
const DIR: Record<string, string> = Object.fromEntries(
	['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'].map((d) => [d, d.replaceAll('W', 'O')])
);

export function quakePlace(place: string): string {
	const km = /^(\d+) km ([NSEW]{1,3}) of (.+)$/.exec(place);
	if (km && DIR[km[2]]) return `${km[1]} km al ${DIR[km[2]]} de ${km[3]}`;
	return place
		.replace(/^near the (?:north |south |east |west )?coast of (?:the )?/i, 'cerca de la costa de ')
		.replace(/^(north|south|east|west)(?:ern)? of (?:the )?/i, (_, d: string) => `al ${{ north: 'norte', south: 'sur', east: 'este', west: 'oeste' }[d.toLowerCase()]} de `);
}

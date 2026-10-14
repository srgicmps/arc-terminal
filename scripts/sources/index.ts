// Lista de todas las fuentes que descarga `pnpm data`.
import type { Source } from '../lib.ts';
import { bls } from './bls.ts';
import { boe } from './boe.ts';
import { ecb } from './ecb.ts';
import { eurostat } from './eurostat.ts';
import { fedreg } from './fedreg.ts';
import { fuel, fuelSpain } from './fuel.ts';
import { hazards, quakesEs } from './hazards.ts';
import { newsSources } from './news.ts';
import { predictions } from './predictions.ts';
import { sec } from './sec.ts';
import { uscurve, usdebt } from './treasury.ts';
import { wiki } from './wiki.ts';
import { crypto, hn, power, quakes, weather } from './world.ts';

export const sources: Source<any>[] = [
	// España
	fuel,
	fuelSpain,
	boe,
	power,
	// Europa
	ecb,
	eurostat,
	// EE. UU.
	fedreg,
	bls,
	usdebt,
	uscurve,
	sec,
	// Mundo
	quakes,
	quakesEs,
	hazards,
	predictions,
	weather,
	crypto,
	hn,
	wiki,
	...newsSources
];

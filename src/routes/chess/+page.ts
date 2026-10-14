import type { Puzzle } from '#lib/chess/puzzle.ts';
import { dataset } from '#lib/data.ts';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => ({ lichess: await dataset<Puzzle>('lichess') });

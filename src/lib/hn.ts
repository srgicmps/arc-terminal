// Temas de la portada de Hacker News, por palabras del titular. Los usan TECH (filtro) y AI (lo que habla de IA).
import type { HnItem } from './types.ts';

export type HnTopic = 'all' | 'ai' | 'dev' | 'science' | 'business';

export const AI_RE =
	/\b(ai|a\.i\.|llms?|gpt|openai|anthropic|claude|gemini|llama|mistral|deepseek|transformer|neural|machine learning|agents?|diffusion|copilot|inference|model)\b/i;

const RE: Record<Exclude<HnTopic, 'all'>, RegExp> = {
	ai: AI_RE,
	dev: /\b(programming|programmer|code|coding|compiler|rust|python|javascript|typescript|golang|go \d|c\+\+|java|linux|kernel|git|github|database|sql|postgres|sqlite|api|open[- ]source|framework|bug|debug|terminal|vim|emacs|wasm|webassembly|css|html|browser)\b/i,
	science: /\b(science|scientists?|physics|quantum|space|nasa|esa|spacex|mars|moon|telescope|biology|cells?|genes?|dna|brain|climate|study|research|researchers|math|mathematics|chemistry|fusion)\b/i,
	business: /\b(startup|ipo|layoffs?|funding|raises|acquires|acquisition|antitrust|ftc|lawsuit|ceo|revenue|valuation|google|apple|microsoft|amazon|meta|nvidia|tesla|intel|amd)\b/i
};

export const HN_TOPICS: { value: HnTopic; label: string }[] = [
	{ value: 'all', label: 'Todo' },
	{ value: 'ai', label: 'IA' },
	{ value: 'dev', label: 'Programación' },
	{ value: 'science', label: 'Ciencia' },
	{ value: 'business', label: 'Empresas' }
];

/** Los titulares del tema (todos con «all»). */
export function hnByTopic(items: HnItem[], topic: HnTopic): HnItem[] {
	return topic === 'all' ? items : items.filter((i) => RE[topic].test(i.title));
}

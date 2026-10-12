export type NumberCandidate = {
    value: number;
    text: string;
};

const WORD_VALUES: Record<string, number> = {
    um: 1,
    uma: 1,
    dois: 2,
    duas: 2,
    tres: 3,
    quatro: 4,
    cinco: 5,
    meia: 6,
    seis: 6,
    sete: 7,
    oito: 8,
    nove: 9,
    dez: 10,
    onze: 11,
    doze: 12,
    treze: 13,
    quatorze: 14,
    catorze: 14,
    quinze: 15,
    dezesseis: 16,
    dezessete: 17,
    dezoito: 18,
    dezenove: 19,
    vinte: 20,
    trinta: 30,
};

const SMALL_WORDS = "um|uma|dois|duas|tres|quatro|cinco|meia|seis|sete|oito|nove";
const WORDS = Object.keys(WORD_VALUES).join("|");

type Span = { start: number; end: number; value: number };

function fold(value: string): string {
    return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function wordValue(word: string): number | undefined {
    return WORD_VALUES[fold(word)];
}

function pushMatches(spans: Span[], text: string, pattern: RegExp, valueOf: (match: RegExpMatchArray) => number | undefined) {
    for (const match of text.matchAll(pattern)) {
        const value = valueOf(match);
        if (value == null || !Number.isFinite(value) || match.index == null) {
            continue;
        }
        spans.push({ start: match.index, end: match.index + match[0].length, value });
    }
}

function nonOverlapping(spans: Span[]): Span[] {
    const sorted = [...spans].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const taken: Span[] = [];
    for (const span of sorted) {
        if (taken.some((other) => span.start < other.end && other.start < span.end)) {
            continue;
        }
        taken.push(span);
    }
    return taken.sort((a, b) => a.start - b.start);
}

export function numberCandidates(message: string): NumberCandidate[] {
    const spans: Span[] = [];

    pushMatches(spans, message, /meia[\s-]+hora/giu, () => 30);
    pushMatches(spans, message, /hora em hora/giu, () => 1);
    pushMatches(spans, message, new RegExp(`(${WORDS}) em \\1`, "giu"), (match) => wordValue(match[1]!));
    pushMatches(spans, message, /(\d+(?:[.,]\d+)?) em \1/giu, (match) => Number(match[1]!.replace(",", ".")));
    pushMatches(spans, message, new RegExp(`vinte e (${SMALL_WORDS})`, "giu"), (match) => {
        const unit = wordValue(match[1]!);
        return unit == null ? undefined : 20 + unit;
    });
    pushMatches(spans, message, new RegExp(`(?<![\\p{L}\\p{N}])(${WORDS})(?![\\p{L}\\p{N}])`, "giu"), (match) =>
        wordValue(match[1]!),
    );
    pushMatches(spans, message, /(?<![\p{L}\p{N}])(\d+(?:[.,]\d+)?)x?(?![\p{L}\p{N}])/giu, (match) =>
        Number(match[1]!.replace(",", ".")),
    );

    const seen = new Set<number>();
    const candidates: NumberCandidate[] = [];
    for (const span of nonOverlapping(spans)) {
        if (seen.has(span.value)) {
            continue;
        }
        seen.add(span.value);
        candidates.push({ value: span.value, text: message.slice(span.start, span.end) });
    }
    return candidates;
}

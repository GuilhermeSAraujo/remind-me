export type MessageIntent =
    | 'list_reminders'
    | 'reminder'
    | 'delete_reminder'
    | 'help'
    | 'delay_reminder'
    | 'thank';

interface IntentPattern {
    intent: MessageIntent;
    pattern: RegExp;
    priority: number;
}

export const INTENT_PATTERNS: IntentPattern[] = [
    {
        intent: 'list_reminders',
        pattern: /lista|mostra|ver/,
        priority: 1
    },
    {
        intent: 'delete_reminder',
        pattern: /apaga|apague|deleta|delete|remove|remova|exclui|cancela|cancele/,
        priority: 2
    },
    {
        intent: 'delay_reminder',
        pattern: /adiar|atrasar|adia/,
        priority: 3
    },
    {
        intent: 'reminder',
        pattern: /lembre|lembrar|lembrete|lembra|crie|cria|agende|agenda/,
        priority: 4
    },
    {
        intent: 'thank',
        pattern: /obrigado|obrigada|valeu|gratidao|grato|grata/,
        priority: 5
    },
    {
        intent: 'help',
        pattern: /ajuda|help|sobre|como|boa tarde|bom dia|boa noite|tudo bem|como vai|oi|ola|olá|alo/,
        priority: 6
    }
];

export function detectMessageIntent(message: string): MessageIntent | null {
    const firstThreeWords = message
        .split(" ")
        .slice(0, 3)
        .join(" ")
        .toLowerCase();

    // Find the first matching pattern
    const matchedIntent = INTENT_PATTERNS.find(({ pattern }) =>
        pattern.test(firstThreeWords)
    );

    return matchedIntent?.intent ?? null;
}


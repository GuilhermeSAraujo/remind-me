export type MessageIntent =
    | 'list_reminders'
    | 'reminder'
    | 'delete_reminder'
    | 'help'
    | 'delay_reminder'
    | 'thank'
    | 'buy_premium';

interface IntentPattern {
    intent: MessageIntent;
    pattern: RegExp;
    priority: number;
}

/** Requires an explicit delay verb + amount + unit (e.g. "adiar 30 minutos", "delay de 2 horas"). */
export const DELAY_REMINDER_PATTERN =
    /(?:adiar|atrasar|adia|delay(?:\s+de)?)\s+\d+\s*(?:minutos?|horas?|dias?|tempo)\b/i;

export const INTENT_PATTERNS: IntentPattern[] = [
    {
        intent: 'list_reminders',
        pattern: /lista|mostra|ver/,
        priority: 1
    },
    {
        intent: 'delete_reminder',
        pattern: /apaga|apague|apagar|deleta|delete|deletar|remove|remova|remover|exclui|excluir|cancela|cancele|cancelar/,
        priority: 2
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
        intent: 'buy_premium',
        pattern: /quero assinar|assinar|assinatura|premium|plano pago|plano premium|planos/,
        priority: 6
    },
    {
        intent: 'help',
        pattern: /ajuda|help|sobre|como|boa tarde|bom dia|boa noite|tudo bem|como vai|oi|ola|olá|alo/,
        priority: 7
    }
];

export function detectMessageIntent(message: string): MessageIntent | null {
    const normalized = message.toLowerCase().trim();

    if (DELAY_REMINDER_PATTERN.test(normalized)) {
        return 'delay_reminder';
    }

    const firstThreeWords = normalized
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");

    const matchedIntent = INTENT_PATTERNS.find(({ pattern }) =>
        pattern.test(firstThreeWords)
    );

    return matchedIntent?.intent ?? null;
}

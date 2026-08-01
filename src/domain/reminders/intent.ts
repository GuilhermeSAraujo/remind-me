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
        intent: 'delay_reminder',
        pattern: /adiar|atrasar|atrase|adie|adia|adia|atrasa/,
        priority: 5
    },
    {
        intent: 'thank',
        pattern: /obrigado|obrigada|valeu|gratidao|grato|grata/,
        priority: 6
    },
    {
        intent: 'buy_premium',
        pattern: /quero assinar|assinar|assinatura|premium|plano pago|plano premium|planos/,
        priority: 7
    },
    {
        intent: 'help',
        pattern: /ajuda|help|sobre|como|boa tarde|bom dia|boa noite|tudo bem|como vai|oi|ola|olá|alo/,
        priority: 8
    }
];

export function detectMessageIntent(message: string): MessageIntent | null {
    const normalized = message.toLowerCase().trim();

    const firstThreeWords = normalized
        .split(/\s+/)
        .slice(0, 3)
        .join(" ");

    const matchedIntent = INTENT_PATTERNS.find(({ pattern }) =>
        pattern.test(firstThreeWords)
    );

    return matchedIntent?.intent ?? null;
}

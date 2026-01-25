export const HELP_MESSAGE = `Olá! Sou o bot de lembretes. 📝

Para começar a utilizar, envie uma mensagem como:
- "Lembre-me de tomar creatina todo dia às 9h"
- "Me lembre de comprar pão às 14h"
- "Lembrete para abastecer o carro toda semana 19:30"

Se quiser ver os seus lembretes, envie:
- Listar lembretes

Se quiser deletar um lembrete:
- Responda a mensagem do lembrete que deseja deletar com a palavra "Apagar"

Se deseja adiar um lembrete:
- Responda a mensagem do lembrete que deseja adiar com a palavra "Adiar" e informe o tempo desejado, ou data específica.
`;

const PREMIUM_LINK = (phoneNumber: string) =>
    `https://create-payment-689285001769.southamerica-east1.run.app/payment-link/${phoneNumber}`;

export const RATE_LIMIT_MESSAGE = (
    remaining: number,
    resetInHours: number,
    phoneNumber: string,
) => {
    if (remaining === 0) {
        return (
            `⚠️ *Limite diário atingido*\n\n` +
            `Você atingiu seu limite de ${5} interações gratuitas nas últimas 24 horas.\n\n` +
            `✅ Seus lembretes continuarão funcionando normalmente.\n\n` +
            `✨ *Quer acesso ilimitado?*\n` +
            `Assine o plano Premium por apenas R$ 4,90 e crie lembretes sem limites!\n\n` +
            `🔗 Conheça:\n${PREMIUM_LINK(phoneNumber)}\n\n` +
            `⏰ Seu limite será renovado em ${Math.ceil(resetInHours)} horas.`
        );
    }
    //  else if (remaining <= 1 && remaining !== -1) {
    //     return `⚠️ *Atenção:* Você tem apenas ${remaining} ${remaining === 1 ? 'interação restante' : 'interações restantes'} nas próximas 24 horas.`;
    // }
    return null;
};

export const RATE_LIMIT_EXCEEDED_MESSAGE = (resetInHours: number, phoneNumber: string) =>
    `⚠️ *Limite diário atingido*\n\n` +
    `Você já utilizou todas as suas interações gratuitas nas últimas 24 horas.\n\n` +
    `✨ *Quer continuar usando sem limites?*\n` +
    `Assine o Premium por apenas R$ 4,90 e tenha acesso ilimitado!\n\n` +
    `🔗 Assine agora:\n${PREMIUM_LINK(phoneNumber)}\n\n` +
    `⏰ Seu limite será renovado em ${Math.ceil(resetInHours)} horas.`;

export const FREE_USER_REMINDER_LIMIT_MESSAGE = (phoneNumber: string) =>
    `⚠️ *Limite de lembretes atingido*\n\n` +
    `Usuários gratuitos podem ter no máximo 5 lembretes pendentes.\n\n` +
    `Para criar um novo lembrete, você precisa:\n` +
    `• Aguardar que algum lembrete seja enviado, ou\n` +
    `• Deletar um lembrete existente\n\n` +
    `✨ *Quer criar lembretes ilimitados?*\n` +
    `Assine o plano Premium por apenas R$ 4,90 e tenha acesso ilimitado!\n\n` +
    `🔗 Assine agora:\n${PREMIUM_LINK(phoneNumber)}`;

export const PREMIUM_WELCOME_MESSAGE = `🎉 *Bem-vindo ao Premium!*

Olá! Seu pagamento foi confirmado e agora você tem acesso premium!

Aproveite os benefícios:
✨ Lembretes ilimitados
✨ Sem limites de uso da IA
✨ Prioridade no suporte

Obrigado por nos apoiar! 🚀`;

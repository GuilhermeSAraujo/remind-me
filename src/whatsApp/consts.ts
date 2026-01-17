export const HELP_MESSAGE = `Olá! Sou o bot de lembretes. 📝

Para começar a utilizar, envie uma mensagem como:
- "Lembre-me de tomar creatina todo dia às 9h"
- "Me lembre de comprar pão às 14h"
- "Lembrete para abastecer o carro toda semana 19:30"

Se quiser ver os seus lembretes, envie:
- Listar lembretes

Se quiser deletar um lembrete:
- Responda a mensagem do lembrete que deseja deletar com a palavra "Apagar"
`;

const PREMIUM_LINK = "https://seu-site.com/premium";

export const RATE_LIMIT_MESSAGE = (remaining: number, resetInHours: number) => {
    if (remaining === 0) {
        return `⚠️ *Limite diário atingido*\n\n` +
            `Você atingiu seu limite de ${5} interações gratuitas nas últimas 24 horas.\n\n` +
            `✅ Seus lembretes continuarão funcionando normalmente.\n\n` +
            `✨ *Quer acesso ilimitado?*\n` +
            `Assine o plano Premium e crie lembretes sem limites!\n\n` +
            `🔗 Conheça: ${PREMIUM_LINK}\n\n` +
            `⏰ Seu limite será renovado em ${Math.ceil(resetInHours)} horas.`;
    } else if (remaining <= 1) {
        return `⚠️ *Atenção:* Você tem apenas ${remaining} ${remaining === 1 ? 'interação restante' : 'interações restantes'} nas próximas 24 horas.`;
    }
    return null;
};

export const RATE_LIMIT_EXCEEDED_MESSAGE = (resetInHours: number) =>
    `⚠️ *Limite diário atingido*\n\n` +
    `Você já utilizou todas as suas interações gratuitas nas últimas 24 horas.\n\n` +
    `✨ *Quer continuar usando sem limites?*\n` +
    `Assine o Premium e tenha acesso ilimitado!\n\n` +
    `🔗 Assine agora: link em breve!\n\n` +
    `⏰ Seu limite será renovado em ${Math.ceil(resetInHours)} horas.`;

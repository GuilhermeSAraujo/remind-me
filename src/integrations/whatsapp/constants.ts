import { FREE_REMINDERS_PER_24H } from "../../services/reminder-quota";

export const HELP_MESSAGES: string[] = [
    "Olá! Aqui você consegue criar e gerenciar lembretes por mensagem. 📝",
    'Para criar: escreva naturalmente, tipo "Me lembre de comprar pão hoje às 14h" ou "Lembrete para reunião amanhã 15:30".',
    'Recorrentes também: "todo dia às 9h", "toda semana às 19h", "nos dias úteis às 7h".',
    'Ver lembretes: "Listar lembretes" ou "Ver meus lembretes".',
    'Para apagar ou adiar: responda a mensagem do lembrete com "Apagar" ou "Adiar 30 minutos" (ou o tempo que quiser).',
    'Contatos: "Cadastrar pessoa (31)999999999 Nome" envia um convite. A outra pessoa aceita com sim, não ou 👍 / 👎. Envie "Contatos" para listar.',
    'Lembrete para um contato: "Lembre a Nome amanhã 12h de passear com o cachorro". Quem recebe o lembrete é dono dele (apagar/adiar).',
];

const PREMIUM_LINK = (phoneNumber: string) =>
    `https://create-payment-689285001769.southamerica-east1.run.app/payment-link/${phoneNumber}`;

export const RATE_LIMIT_EXCEEDED_MESSAGE = (resetInHours: number, phoneNumber: string) =>
    `⚠️ *Limite diário atingido*\n\n` +
    `Você já criou ${FREE_REMINDERS_PER_24H} lembretes nas últimas 24 horas.\n\n` +
    `✨ *Quer continuar criando sem limite diário?*\n` +
    `Assine o Premium por apenas R$ 4,90.\n\n` +
    `🔗 Assine agora:\n${PREMIUM_LINK(phoneNumber)}\n\n` +
    `⏰ Seu limite será renovado em ${Math.ceil(resetInHours)} horas.`;

export const RATE_LIMIT_PARTIAL_MESSAGE = (skipped: number, phoneNumber: string) => {
    const noun = skipped === 1
        ? "lembrete não foi criado"
        : "lembretes não foram criados";
    return (
        `⚠️ *Limite diário*\n\n` +
        `${skipped} ${noun}. O plano gratuito permite ${FREE_REMINDERS_PER_24H} lembretes a cada 24 horas.\n\n` +
        `✨ *Quer criar sem limite diário?*\n` +
        `Assine o Premium por apenas R$ 4,90.\n\n` +
        `🔗 Assine agora:\n${PREMIUM_LINK(phoneNumber)}`
    );
};

export const BUY_PREMIUM_MESSAGE = (phoneNumber: string) =>
    `✨ *Remind Me Premium*\n\n` +
    `Com o Premium você tem:\n` +
    `• Criação de lembretes sem limite diário\n` +
    `• Suporte prioritário\n\n` +
    `💰 Apenas *R$ 4,90/mês*\n\n` +
    `🔗 Assine agora:\n${PREMIUM_LINK(phoneNumber)}`;

export const PREMIUM_WELCOME_MESSAGES: string[] = [
    "🎉 Pagamento confirmado! Você agora é Premium.",
    "✨ Você pode criar lembretes sem limite diário.",
    "Obrigado por apoiar! Qualquer dúvida, é só falar. 🚀",
];

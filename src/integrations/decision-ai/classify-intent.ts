import { choice } from "@typesafe-ai/sdk";
import type { MessageIntent } from "../../domain/reminders/intent";
import { decisionClient } from "./client";

export const INTENT_CONFIDENCE_FLOOR = 0.5;

const intentCriteria = {
    reminder: {
        definition: "The user wants to create a new reminder for themselves or for a contact.",
        examples: [
            "Me lembre de comprar pão às 14h",
            "Lembrete para tomar água amanhã",
            "Ligar para o Pedro amanhã às 10h",
            "Cobrar a Maria amanhã às 09:00",
            "Lembre de cadastrar o carro",
        ],
        excludes: [
            "Listing, deleting, or delaying an existing reminder",
            "Registering a person with cadastrar pessoa",
        ],
    },
    list_reminders: {
        definition: "The user wants to see their existing reminders.",
        examples: [
            "Quais são meus lembretes?",
            "Lista meus lembretes",
            "Mostrar lembretes",
            "Ver meus lembretes",
        ],
        excludes: ["Listing contacts", "Creating a new reminder"],
    },
    delete_reminder: {
        definition: "The user wants to delete, cancel, or remove an existing reminder.",
        examples: [
            "Apagar lembrete",
            "Deletar lembrete de comprar pão",
            "Remover lembrete",
            "apagar 2",
        ],
        excludes: ["Creating a reminder whose task happens to mention canceling something"],
    },
    delay_reminder: {
        definition:
            "The user wants to postpone an existing reminder and says for how long, such as minutes, hours, or days.",
        examples: ["Adiar 30 minutos", "Atrasar 2 horas", "delay de 15 minutos", "Adiar 1 dia"],
        excludes: ["Adiar", "1", "30", "amanhã"],
    },
    register_contact: {
        definition:
            "The user wants to register or add a person, typically starting with cadastrar pessoa and a phone number.",
        examples: ["Cadastrar pessoa (31)999999999 Victor"],
        excludes: ["Lembre de cadastrar o carro"],
    },
    list_contacts: {
        definition: "The user wants to see their saved contacts.",
        examples: ["Contatos", "Meus contatos"],
        excludes: ["Listing reminders"],
    },
    buy_premium: {
        definition: "The user wants to buy, subscribe to, or ask the price of the premium plan.",
        examples: [
            "Quero assinar o premium",
            "Quanto custa o plano pago?",
            "Quero comprar o premium",
        ],
        excludes: ["Asking how to use the bot"],
    },
    thank: {
        definition: "The user is thanking the bot and is not asking for another action.",
        examples: ["obrigado", "obrigada", "valeu", "muito obrigado"],
        excludes: ["A thank-you that also asks to create, list, delete, or delay a reminder"],
    },
    help: {
        definition:
            "Greeting, help request, bare number, incomplete command, or anything that does not clearly match another flow.",
        examples: [
            "1",
            "30",
            "amanhã",
            "Adiar",
            "Ajuda",
            "Oi",
            "Quero começar a usar",
            "O que você faz?",
        ],
        excludes: ["A message that clearly matches another flow"],
    },
} satisfies Record<
    MessageIntent,
    { definition: string; examples: string[]; excludes: string[] }
>;

export function intentFromChoice(answer: {
    choice: MessageIntent;
    confidence: number;
}): MessageIntent {
    if (answer.confidence < INTENT_CONFIDENCE_FLOOR) {
        return "help";
    }
    return answer.choice;
}

export async function classifyMessageIntent(message: string): Promise<MessageIntent> {
    const response = await decisionClient.systemOne({
        state: { message },
        questions: {
            intent: choice(
                {
                    question: "Which flow should this WhatsApp message follow?",
                    use: "`message`",
                },
                intentCriteria,
            ),
        },
    });

    return intentFromChoice(response.answers.intent);
}

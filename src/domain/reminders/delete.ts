import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { Reminder } from "./reminder.model";
import { getRemindersInListOrder } from "./reminders-list-order.helper";

/**
 * Extrai um número de uma mensagem de deletar (ex: "apagar 1", "deletar 2", "remover 3")
 * Retorna o número encontrado ou null se não houver número válido
 */
function extractNumberFromMessage(message: string): number | null {
    // Padrão para capturar números após palavras de deletar
    const pattern = /(?:apagar|apague|deletar|delete|remove|remova|exclui|excluir|cancela|cancele)\s+(\d+)/i;
    const match = message.match(pattern);

    if (match && match[1]) {
        const number = parseInt(match[1], 10);
        return isNaN(number) ? null : number;
    }

    return null;
}

export async function deleteReminder({
    userData,
    messageText
}: {
    userData: UserData;
    quotedMsgId?: string;
    messageText?: string;
}): Promise<boolean> {
    let reminder = null;

    // Tentar encontrar pelo número da lista se messageText contiver um número
    if (messageText) {
        const listNumber = extractNumberFromMessage(messageText);

        if (listNumber !== null) {
            const reminders = await getRemindersInListOrder(userData.phoneNumber);

            // Validar se o número está no range válido (1 até quantidade de lembretes)
            if (listNumber >= 1 && listNumber <= reminders.length) {
                // Usar índice baseado em 1 (listNumber - 1 para array baseado em 0)
                reminder = reminders[listNumber - 1];
            } else {
                await sendMessage({
                    phone: userData.phoneNumber,
                    message: `Número inválido. Você tem ${reminders.length} lembrete(s) pendente(s). Use um número entre 1 e ${reminders.length}.`,
                });
                return false;
            }
        }
    }


    if (!reminder) {
        await sendMessage({
            phone: userData.phoneNumber,
            message: `Não foi possível identificar o lembrete a ser deletado. Envie 'Listar' para identificar qual lembrete deve ser removido.`,
        });
        return false;
    }
    console.log("[DELETE REMINDER] ⚠ Reminder found?:", reminder);
    await Reminder.deleteOne({ _id: reminder._id, userPhoneNumber: userData.phoneNumber });

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete "${reminder?.title}" apagado com sucesso.`,
    });
    return true;
}

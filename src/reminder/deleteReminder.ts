import { UserData } from "../middlewares";
import { sendMessage } from "../whatsApp";

export async function deleteReminder({ userData }: { userData: UserData }) {
    await sendMessage({
        phone: userData.phoneNumber,
        message: "❌ A funcionalidade de deletar lembretes ainda não foi implementada.\n\nEm breve você poderá remover lembretes específicos!",
    });
}


import { Reminder } from "../db/schemas";
import { UserData } from "../middlewares";
import { sendMessage, sendImage } from "../whatsApp";

export async function deleteReminder({ userData, quotedMsgId }: { userData: UserData, quotedMsgId?: string }) {
    if (!quotedMsgId) {
        await reminderNotFoundMessage({ userData });
        return;
    }

    const reminder = await Reminder.findOne({ messageId: quotedMsgId, userPhoneNumber: userData.phoneNumber });

    if (!reminder) {
        await reminderNotFoundMessage({ userData });
        return;
    }

    await Reminder.deleteOne({ _id: reminder._id, userPhoneNumber: userData.phoneNumber, messageId: quotedMsgId });

    await sendMessage({
        phone: userData.phoneNumber,
        message: `Lembrete "${reminder?.title}" apagado com sucesso.`,
    });
}


async function reminderNotFoundMessage({ userData }: { userData: UserData }) {
    await sendImage(
        {
            phone: userData.phoneNumber,
            filename: "delete-reminder.jpeg",
            caption: "Não foi possível encontrar o lembrete para ser excluído. \nAcima temos um exemplo de como apagar um lembrete.",
        },
        "delete-reminder.jpeg"
    );
}
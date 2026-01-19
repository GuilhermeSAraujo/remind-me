import { UserData } from "../../api/middlewares/user-extractor.middleware";
import { sendMessage } from "../../integrations/whatsapp/send-message";
import { sendImage } from "../../integrations/whatsapp/send-image";
import { Reminder } from "./reminder.model";

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
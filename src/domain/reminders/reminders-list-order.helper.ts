import { phoneVariantFilter } from "../contacts/phone";
import { Reminder } from "./reminder.model";

/**
 * Obtém lembretes na mesma ordem usada na listagem
 * (ordenados por scheduledTime ascendente e com status "pending").
 */
export async function getRemindersInListOrder(userPhoneNumber: string) {
    return Reminder.find({
        userPhoneNumber: phoneVariantFilter(userPhoneNumber),
        status: "pending",
    }).sort({ scheduledTime: 1 });
}

/**
 * Lembretes que o usuário criou para outras pessoas (somente leitura na listagem).
 */
export async function getRemindersCreatedForOthers(creatorPhoneNumber: string) {
    const variants = phoneVariantFilter(creatorPhoneNumber);
    return Reminder.find({
        createdByPhoneNumber: variants,
        userPhoneNumber: { $nin: variants.$in },
        status: "pending",
    }).sort({ scheduledTime: 1 });
}


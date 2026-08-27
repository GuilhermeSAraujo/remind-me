import { userPhoneVariants, digitsOnly } from "../contacts/phone";
import { IUser, User } from "./user.model";

export async function findUserByAnyPhone(phone: string): Promise<IUser | null> {
    const digits = digitsOnly(phone);
    if (!digits) {
        return null;
    }
    return User.findOne({ phoneNumber: { $in: userPhoneVariants(digits) } });
}

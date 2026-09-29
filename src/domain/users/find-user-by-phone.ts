import { userPhoneVariants, digitsOnly, preferBareDigitUser } from "../contacts/phone";
import { IUser, User } from "./user.model";

export async function findUserByAnyPhone(phone: string): Promise<IUser | null> {
    const digits = digitsOnly(phone);
    if (!digits) {
        return null;
    }
    const matches = await User.find({ phoneNumber: { $in: userPhoneVariants(digits) } });
    return preferBareDigitUser(matches);
}

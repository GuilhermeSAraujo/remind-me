import { sendMessage } from "../../integrations/whatsapp/send-message";
import { phoneLookupKeys } from "../contacts/phone";
import { IUser, User } from "./user.model";

export class UserService {
  /**
   * Find or create a user by phone number.
   * When `lidJid` is provided and the user was previously stored with the LID,
   * their phone number is migrated to the resolved real number.
   */
  async findOrCreateUser(
    phoneNumber: string,
    name: string,
    lidJid?: string,
  ): Promise<IUser> {
    let user = await User.findOne({
      phoneNumber: { $in: phoneLookupKeys(phoneNumber) },
    });

    if (!user && lidJid) {
      user = await User.findOne({ phoneNumber: lidJid });
      if (user && !phoneNumber.includes("@lid")) {
        user.phoneNumber = phoneNumber;
        await user.save();
      }
    }

    if (!user) {
      user = await User.create({
        phoneNumber,
        name,
        isPremium: true,
        premiumExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      void sendMessage({
        phone: "553199777722",
        message: `Novo usuário criado: ${name} (Premium até ${user.premiumExpiresAt?.toLocaleString()})`,
      });
    }

    return user;
  }
}

import { sendMessage } from "../../integrations/whatsapp/send-message";
import { IUser, User } from "./user.model";

export class UserService {
  /**
   * Find or create a user by phone number.
   * When `lidNumber` is provided and the user was previously stored with the LID,
   * their phone number is migrated to the resolved real number.
   */
  async findOrCreateUser(phoneNumber: string, name: string, lidNumber?: string): Promise<IUser> {
    let user = await User.findOne({ phoneNumber });

    if (!user && lidNumber && lidNumber !== phoneNumber) {
      user = await User.findOne({ phoneNumber: lidNumber });
      if (user) {
        user.phoneNumber = phoneNumber;
        await user.save();
        console.info(`[USER SERVICE] Migrated LID ${lidNumber} → ${phoneNumber} for ${name}`);
      }
    }

    if (!user) {
      user = await User.create({ phoneNumber, name });

      void sendMessage({
        phone: "553199777722",
        message: "Novo usuário criado: " + name,
      });
    }

    return user;
  }
}

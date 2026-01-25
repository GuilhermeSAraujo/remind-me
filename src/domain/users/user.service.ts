import { IUser, User } from "./user.model";

export class UserService {
  /**
   * Find or create a user by phone number and name
   */
  async findOrCreateUser(phoneNumber: string, name: string): Promise<IUser> {
    let user = await User.findOne({ phoneNumber });

    if (!user) {
      // Create new user
      user = await User.create({ phoneNumber, name });
    }

    return user;
  }
}

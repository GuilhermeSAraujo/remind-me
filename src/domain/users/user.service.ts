import { User, IUser } from "./user.model";
import { Reminder } from "../reminders/reminder.model";

export class UserService {
  /**
   * Find or create a user by phone number and name
   */
  async findOrCreateUser(phoneNumber: string, name: string): Promise<IUser> {
    let user = await User.findOne({ phoneNumber });
    
    if (!user) {
      // Try to find user by name (in case phone number changed)
      const existingUser = await User.findOne({ name });
      
      if (existingUser) {
        // Update phone number and all associated reminders
        await this.updateUserPhoneNumber(existingUser, phoneNumber);
        user = existingUser;
      } else {
        // Create new user
        user = await User.create({ phoneNumber, name });
      }
    }
    
    return user;
  }

  /**
   * Update user's phone number and all associated reminders
   */
  private async updateUserPhoneNumber(user: IUser, newPhoneNumber: string): Promise<void> {
    // Update all reminders with old phone number
    await Reminder.updateMany(
      { userPhoneNumber: user.phoneNumber },
      { userPhoneNumber: newPhoneNumber }
    );
    
    console.log('[USER SERVICE] Updated reminders for phone number change:', {
      oldPhone: user.phoneNumber,
      newPhone: newPhoneNumber,
    });
    
    // Update user phone number
    user.phoneNumber = newPhoneNumber;
    await user.save();
    
    console.log('[USER SERVICE] Updated user phone number:', {
      name: user.name,
      newPhone: newPhoneNumber,
    });
  }
}


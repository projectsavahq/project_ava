import { User, IUser } from '../models/schemas/User';
import { logInfo, logError, logWarn } from '../utils/logger';

export interface GetUsersOptions {
  page?: number;
  limit?: number;
  search?: string;
  filterSuspended?: boolean;
}

export interface AddNoteData {
  userId: string;
  note: string;
  adminId: string;
  adminEmail: string;
}

export interface SuspendUserData {
  userId: string;
  reason: string;
}

export class AdminUserService {
  /**
   * Get all users with pagination and filtering
   */
  async getUsers(options: GetUsersOptions = {}): Promise<{
    users: IUser[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 10;
      const skip = (page - 1) * limit;

      // Build query
      const query: any = {};

      // Filter by suspension status if specified
      if (options.filterSuspended === true) {
        query.isSuspended = true;
      } else if (options.filterSuspended === false) {
        query.isSuspended = false;
      }

      // Search by email or name
      if (options.search) {
        query.$or = [
          { email: { $regex: options.search, $options: 'i' } },
          { name: { $regex: options.search, $options: 'i' } }
        ];
      }

      // Get total count
      const total = await User.countDocuments(query);

      // Get users with pagination
      const users = await User.find(query)
        .select('-password -passwordHistory -emailVerificationToken -passwordResetToken')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      logInfo(`Retrieved ${users.length} users`);

      return {
        users,
        total,
        page,
        limit
      };
    } catch (error) {
      logError('Failed to fetch users', error);
      throw error;
    }
  }

  /**
   * Get a single user by ID
   */
  async getUserById(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId)
        .select('-password -passwordHistory -emailVerificationToken -passwordResetToken');

      if (!user) {
        throw new Error('User not found');
      }

      logInfo(`Retrieved user: ${userId}`);
      return user;
    } catch (error) {
      logError('Failed to fetch user', error);
      throw error;
    }
  }

  /**
   * Add admin note to user
   */
  async addAdminNote(data: AddNoteData): Promise<IUser> {
    try {
      const { userId, note, adminId, adminEmail } = data;

      if (!note || note.trim().length === 0) {
        throw new Error('Note cannot be empty');
      }

      if (note.length > 1000) {
        throw new Error('Note cannot exceed 1000 characters');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Add note to adminNotes array
      user.adminNotes.push({
        note: note.trim(),
        adminId,
        adminEmail,
        createdAt: new Date()
      });

      await user.save();

      logInfo(`Admin note added to user ${userId} by admin ${adminId}`);

      return user;
    } catch (error) {
      logError('Failed to add admin note', error);
      throw error;
    }
  }

  /**
   * Suspend a user account
   */
  async suspendUser(data: SuspendUserData): Promise<IUser> {
    try {
      const { userId, reason } = data;

      if (!reason || reason.trim().length === 0) {
        throw new Error('Suspension reason is required');
      }

      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (user.isSuspended) {
        throw new Error('User is already suspended');
      }

      // Suspend the user
      user.isSuspended = true;
      user.suspensionReason = reason.trim();
      user.suspendedAt = new Date();
      user.isActive = false;

      await user.save();

      logInfo(`User ${userId} suspended. Reason: ${reason}`);

      return user;
    } catch (error) {
      logError('Failed to suspend user', error);
      throw error;
    }
  }

  /**
   * Unsuspend a user account
   */
  async unsuspendUser(userId: string): Promise<IUser> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.isSuspended) {
        throw new Error('User is not suspended');
      }

      // Unsuspend the user
      user.isSuspended = false;
      user.suspensionReason = undefined;
      user.suspendedAt = undefined;
      user.isActive = true;

      await user.save();

      logInfo(`User ${userId} unsuspended`);

      return user;
    } catch (error) {
      logError('Failed to unsuspend user', error);
      throw error;
    }
  }
}

export const adminUserService = new AdminUserService();

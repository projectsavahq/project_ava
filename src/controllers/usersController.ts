import { Request, Response } from "express";
import { UsersService } from "../services";

export class UsersController {
  private usersService: UsersService;

  constructor() {
    this.usersService = new UsersService();
  }

  /**
   * Get user profile by userId
   */
  getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const user = await this.usersService.getUserProfile(userId);
      
      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  };

  /**
   * Update user preferences
   */
  updateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const updatedUser = await this.usersService.updateUserProfile(userId, updates);
      
      if (!updatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        message: "User updated successfully",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  };



  /**
   * Deactivate user (soft delete)
   */
  deactivateUser = async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      const deactivatedUser = await this.usersService.deactivateUser(userId);
      
      if (!deactivatedUser) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      res.json({
        message: "User deactivated successfully",
        userId: deactivatedUser.userId,
        isActive: deactivatedUser.isActive,
      });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ error: "Failed to deactivate user" });
    }
  };

  /**
   * Get user's crisis history
   */
//   getCrisisHistory = async (req: Request, res: Response): Promise<void> => {
//     try {
//       const { userId } = req.params;
//       const { limit = "20" } = req.query;

//       const crisisData = await this.usersService.getCrisisHistory(
//         userId, 
//         parseInt(limit as string)
//       );

//       if (crisisData === null) {
//         res.status(404).json({ error: "User not found" });
//         return;
//       }

//       res.json({
//         userId,
//         crisisHistory: crisisData.crisisHistory,
//         events: crisisData.events,
//       });
//     } catch (error) {
//       console.error("Error fetching crisis events:", error);
//       res.status(500).json({ error: "Failed to fetch crisis events" });
//     }
//   };
}
import { Router } from "express";
import { UsersController } from "../controllers";

const router = Router();
const usersController = new UsersController();

// Get user profile by userId
router.get("/:userId", usersController.getUserProfile);

// Update user preferences
router.patch("/:userId", usersController.updateUser);

// Get user's conversation sessions
// Deactivate user (soft delete)
router.delete("/:userId", usersController.deactivateUser);

// Get user's crisis history

export default router;

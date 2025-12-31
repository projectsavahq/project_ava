import { Router } from 'express';
import { sessionsController } from '../controllers/sessionsController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

/**
 * @swagger
 * /api/sessions:
 *   get:
 *     tags: [Sessions]
 *     summary: Get user's voice chat sessions
 *     description: Retrieve paginated list of user's voice chat sessions
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of sessions per page
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Sessions retrieved successfully"
 *               data:
 *                 sessions: [...]
 *                 pagination:
 *                   page: 1
 *                   limit: 10
 *                   total: 25
 *                   pages: 3
 */
router.get('/', authMiddleware, sessionsController.getUserSessions);

/**
 * @swagger
 * /api/sessions/{sessionId}/messages:
 *   get:
 *     tags: [Sessions]
 *     summary: Get messages for a session
 *     description: Retrieve all messages (user and assistant) for a specific voice chat session
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Session ID
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Messages retrieved successfully"
 *               data:
 *                 session: {...}
 *                 messages: [...]
 */
router.get('/:sessionId/messages', authMiddleware, sessionsController.getSessionMessages);

/**
 * @swagger
 * /api/sessions/stats:
 *   get:
 *     tags: [Sessions]
 *     summary: Get session statistics
 *     description: Retrieve statistics about user's voice chat sessions and messages
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *             example:
 *               success: true
 *               message: "Session statistics retrieved successfully"
 *               data:
 *                 sessions:
 *                   totalSessions: 25
 *                   activeSessions: 1
 *                   totalDuration: 3600000
 *                   avgDuration: 144000
 *                 messages:
 *                   user: 150
 *                   assistant: 145
 */
router.get('/stats', authMiddleware, sessionsController.getSessionStats);

export default router;
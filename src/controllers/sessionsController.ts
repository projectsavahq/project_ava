import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Session, Message } from '../models/schemas';

export class SessionsController {
  /**
   * GET /api/sessions
   * Get user's sessions
   */
  async getUserSessions(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const sessions = await Session.find({ userId })
        .sort({ startTime: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v');

      const total = await Session.countDocuments({ userId });

      res.json({
        success: true,
        message: 'Sessions retrieved successfully',
        data: {
          sessions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve sessions'
      });
    }
  }

  /**
   * GET /api/sessions/:sessionId
   * Get a session and all messages
   */
  async getSessionById(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const session = await Session.findOne({ sessionId, userId }).select('-__v');
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
        return;
      }

      const messages = await Message.find({ sessionId })
        .sort({ timestamp: 1 })
        .select('-__v');

      res.json({
        success: true,
        message: 'Session retrieved successfully',
        data: {
          session,
          messages
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve session'
      });
    }
  }

  /**
   * GET /api/sessions/:sessionId/messages
   * Get messages for a session with cursor pagination
   */
  async getSessionMessages(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.params;
      const { limit = 20, cursor } = req.query as { limit?: number; cursor?: string };
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const session = await Session.findOne({ sessionId, userId });
      if (!session) {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
        return;
      }

      const query: Record<string, unknown> = { sessionId };
      if (cursor) {
        if (!Types.ObjectId.isValid(cursor)) {
          res.status(400).json({
            success: false,
            message: 'Invalid cursor'
          });
          return;
        }
        query._id = { $gt: new Types.ObjectId(cursor) };
      }

      const messages = await Message.find(query)
        .sort({ _id: 1 })
        .limit(Number(limit) + 1)
        .select('-__v');

      const hasMore = messages.length > Number(limit);
      if (hasMore) {
        messages.pop();
      }

      const nextCursor = hasMore ? messages[messages.length - 1]?._id : null;

      res.json({
        success: true,
        message: 'Messages retrieved successfully',
        data: {
          session: {
            sessionId: session.sessionId,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
            duration: session.duration
          },
          messages,
          pagination: {
            limit: Number(limit),
            nextCursor,
            hasMore
          }
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve messages'
      });
    }
  }

  /**
   * GET /api/sessions/stats
   * Get user's session statistics
   */
  async getSessionStats(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
        return;
      }

      const stats = await Session.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: null,
            totalSessions: { $sum: 1 },
            activeSessions: {
              $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
            },
            totalDuration: { $sum: { $ifNull: ['$duration', 0] } },
            avgDuration: { $avg: { $ifNull: ['$duration', 0] } }
          }
        }
      ]);

      const messageStats = await Message.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]);

      res.json({
        success: true,
        message: 'Session statistics retrieved successfully',
        data: {
          sessions: stats[0] || {
            totalSessions: 0,
            activeSessions: 0,
            totalDuration: 0,
            avgDuration: 0
          },
          messages: messageStats.reduce((acc, stat) => {
            acc[stat._id] = stat.count;
            return acc;
          }, {})
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve statistics'
      });
    }
  }
}

export const sessionsController = new SessionsController();
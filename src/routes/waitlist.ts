import { Router } from 'express';
import { createWaitlist, getWaitlist, deleteWaitlist } from '../controllers/waitlistController';
import { validateWaitlist } from '../validations/waitlistValidation';

/**
 * @swagger
 * /api/waitlist:
 *   post:
 *     tags: [Waitlist]
 *     summary: Join the waitlist
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/WaitlistRequest'
 *     responses:
 *       201:
 *         description: Waitlist entry created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/WaitlistEntry'
 *       400:
 *         description: Validation failed
 *       409:
 *         description: Email already on waitlist
 *   get:
 *     tags: [Waitlist]
 *     summary: List waitlist entries
 *     responses:
 *       200:
 *         description: List of waitlist entries
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/WaitlistEntry'
 *       500:
 *         description: Failed to fetch entries
 *
 * /api/waitlist/{id}:
 *   delete:
 *     tags: [Waitlist]
 *     summary: Remove an entry from the waitlist
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Waitlist entry identifier
 *     responses:
 *       200:
 *         description: Entry removed successfully
 *       404:
 *         description: Entry not found
 *       500:
 *         description: Failed to delete entry
 */

const router = Router();

router.post('/', validateWaitlist, createWaitlist);
router.get('/', getWaitlist);
router.delete('/:id', deleteWaitlist);

export default router;

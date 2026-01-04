import { Router } from 'express';
import { createWaitlist, getWaitlist, deleteWaitlist } from '../controllers/waitlistController';
import { validateWaitlist } from '../validations/waitlistValidation';

const router = Router();

router.post('/', validateWaitlist, createWaitlist);
router.get('/', getWaitlist);
router.delete('/:id', deleteWaitlist);

export default router;

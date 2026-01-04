import { Request, Response } from 'express';
import { Waitlist } from '../models/schemas';

export const createWaitlist = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    // Check if email already exists
    const exists = await Waitlist.findOne({ email });
    if (exists) {
      return res.status(409).json({ error: 'Email already on waitlist' });
    }
    const entry = await Waitlist.create({ email });
    return res.status(201).json({ id: entry._id, email: entry.email, createdAt: entry.createdAt });
  } catch (err: any) {
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to add to waitlist' });
  }
};

export const getWaitlist = async (_req: Request, res: Response) => {
  try {
    const list = await Waitlist.find().select('email createdAt');
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to fetch waitlist' });
  }
};

export const deleteWaitlist = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await Waitlist.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Entry not found' });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: 'Failed to delete entry' });
  }
};

import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'


/**
 * CREATE User Report
 * POST /api/dashboard/user-report         
 * Body: { userId: String, reportData: Json }
 */

router.post('/api/dashboard/user-report/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { reportData } = req.body;

    if (!userId || !reportData) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const report = await prisma.userReport.create({
      data:{
        userId,
        reportData
      }
    })
    res.status(201).json({
      success: true,
      message: 'User report created successfully',
      data: report
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create user report', error: error.message });
  }
})





export default router;

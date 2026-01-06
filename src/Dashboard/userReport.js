import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'
import { protect } from '../Middleware/authMiddleware.js';


/**
 * CREATE User Report
 * POST /api/dashboard/user-report
 * Body: { userId: String, reportData: Json }
 */

router.post('/api/dashboard/user-report', [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { reportData } = req.body;

    if (!userId || !reportData) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if(user.userId !== userId) {
      return res.status(401).json({ success: false,message: 'Unauthorized' });
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
    res.status(500).json({success: false, message: 'Failed to create user report', error: error.message });
  }
})


/**
 * GET User Reports
 * GET /api/dashboard/user-report
 */
router.get('/api/dashboard/user-report', [protect],async (req, res) => {
  try {
    const { userId } = req.user;

    if (!userId) {
      return res.status(400).json({success : false, message: 'User ID is required' });
    }
    const reports = await prisma.userReport.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });



    if (reports.length === 0) {
      return res.status(404).json({ success: false, message: 'User reports is empty' });
    }

    if(reports[0].userId !== userId) {
      return res.status(401).json({ success: false,message: 'Unauthorized' });
    }

    res.status(200).json({
      success: true,
      message: 'User reports fetched successfully',
      data: reports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({success: false, message: 'Failed to fetch user reports', error: error.message });
  }
})





export default router;

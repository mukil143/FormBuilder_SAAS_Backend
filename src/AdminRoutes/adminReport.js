import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'


/**
 * Get all User issue Reports by Admin
 * GET /api/dashboard/admin/user-reports
 * Query Params: userId (Admin's userId)
 */
router.get('/api/dashboard/admin/user-reports', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const reports = await prisma.userReport.findMany();

    if (!reports) {
      return res.status(404).json({ message: 'User reports not found' });
    }

    res.status(200).json({
      success: true,
      message: 'User reports fetched successfully',
      data: reports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to fetch user reports', error: error.message });
  }
});


/**
 * Update User Report Status by Admin
 * PATCH /api/dashboard/admin/user-report/:reportId/status
 * Body: { status: ReportStatus }
 * Params: reportId
 */
router.patch('/api/dashboard/admin/user-report/:reportId/status', async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status } = req.body;

    if (!reportId) {
      return res.status(400).json({ message: 'Report ID is required' });
    }

    const updatedReport = await prisma.userReport.update({
      where: { reportId },
      data: {
        status,
        updatedAt: new Date()
       }
    });
    res.status(200).json({
      success: true,
      message: 'User report status updated successfully',
      data: updatedReport
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Failed to update user report status', error: error.message });
  }
});



export default router;


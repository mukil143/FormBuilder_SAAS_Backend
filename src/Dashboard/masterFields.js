import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'


// ============================
// CREATE Master Field
// ============================
router.post('/api/dashboard/master-fields', async (req, res) => {
  try {
    const { name, type, userId } = req.body;

    if (!name || !type || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const masterField = await prisma.masterField.create({
      data: req.body
    });

    res.status(201).json(masterField);
  } catch (error) {
    res.status(500).json({ message: 'Failed to create master field', error: error.message });
  }
});


// ============================
// READ all Master Fields by User
// ============================
router.get('/api/dashboard/master-fields/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const masterFields = await prisma.masterField.findMany({
      where: { userId }
    });

    res.status(200).json(masterFields);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch master fields', error: error.message });
  }
});


// ============================
// READ single Master Field by ID
// ============================
router.get('/api/dashboard/master-fields/:masterFieldId', async (req, res) => {
  try {
    const { masterFieldId } = req.params;

    const masterField = await prisma.masterField.findUnique({
      where: { masterFieldId: masterFieldId }
    });

    if (!masterField) {
      return res.status(404).json({ message: 'Master field not found' });
    }

    res.status(200).json(masterField);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch master field', error: error.message });
  }
});


// ============================
// UPDATE Master Field
// ============================
router.put('/api/dashboard/master-fields/:masterFieldId', async (req, res) => {
  try {
    const { masterFieldId } = req.params;

    const updated = await prisma.masterField.update({
      where: { masterFieldId: masterFieldId },
      data: req.body
    });

    res.status(200).json(updated);
  } catch (error) {
    res.status(404).json({ message: 'Master field not found or update failed' });
  }
});


// ============================
// DELETE Master Field
// ============================
router.delete('/api/dashboard/master-fields/:masterFieldId', async (req, res) => {
  try {
    const { masterFieldId } = req.params;

    await prisma.masterField.delete({
      where: { masterFieldId: id }
    });

    res.status(200).json({ message: 'Master field deleted successfully' });

  } catch (error) {
    res.status(404).json({ message: 'Master field not found' });
  }
});

export default router;

import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'


// ============================
// CREATE Master Field
// ============================
router.post('/api/dashboard/master-fields', async (req, res) => {
  try {
    const { name, type, userId , options} = req.body;

    if (!name || !type || !userId) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if( type === 'DROPDOWN' || type === 'CHECKBOX' || type === 'RADIO') {
      if(!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ message: `Options are required for field type ${type} and must be a non-empty array.` });
      }
    }


    // const existingMasterField = await prisma.masterField.findUnique({ where: { type: type} });
    // if (existingMasterField) {
    //   return res.status(400).json({ message: 'Master field already exists' });
    // }



    if (!['TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE'].includes(type)) {
      return res.status(400).json({ message: 'Invalid field type, must be one of: (TEXT, EMAIL, NUMBER, TEXTAREA, DROPDOWN, CHECKBOX, RADIO, DATE)' });
    }

    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const masterField = await prisma.masterField.create({
      data: {
        name,
        type,
        userId,
        options: options || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Master field created successfully',
      data: masterField
    });
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
    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }
    const masterFields = await prisma.masterField.findMany({
      where: { userId }
    });

    if (!masterFields) {
      return res.status(404).json({ message: 'Master fields not found' });
    }

    res.status(200).json({
      success: true,
      message: 'Master fields fetched successfully',
      data: masterFields
    });
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

    res.status(200).json({
      success: true,
      message: 'Master field fetched successfully',
      data: masterField
    });
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
    const { name, type } = req.body;
    if( !masterFieldId ) {
      return res.status(400).json({ message: 'Master field ID is required' });
    }
    if (!name || !type) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    if (!['TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE'].includes(type)) {
      return res.status(400).json({ message: 'Invalid field type must be one of: (TEXT, EMAIL, NUMBER, TEXTAREA, DROPDOWN, CHECKBOX, RADIO, DATE)' });
    }


    if(type === 'DROPDOWN' || type === 'CHECKBOX' || type === 'RADIO') {
      return res.status(400).json({ message: `Cannot change field type to ${type} as it requires options. Please create a new master field instead.` });
    }

    const updated = await prisma.masterField.update({
      where: { masterFieldId: masterFieldId },
      data: {
        name,
        type
      }
    });

    res.status(200).json({
      success: true,
      message: 'Master field updated successfully',
      data: updated
    });
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

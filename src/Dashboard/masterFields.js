import express from 'express';
const router = express.Router();
import { prisma } from '../config/db.js'
import { admin, protect } from '../Middleware/authMiddleware.js';


// ============================
// CREATE Master Field
// ============================
router.post('/api/dashboard/master-fields', [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { label, type , options} = req.body;

    if (!label || !type || !userId) {
      return res.status(400).json({success: false,message: 'Missing required fields' });
    }

    if( type === 'DROPDOWN' || type === 'CHECKBOX' || type === 'RADIO') {
      if(!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ success: false, message: `Options are required for field type ${type} and must be a non-empty array.` });
      }
    }


    // const existingMasterField = await prisma.masterField.findUnique({ where: { type: type} });
    // if (existingMasterField) {
    //   return res.status(400).json({ message: 'Master field already exists' });
    // }



    if (!['TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE'].includes(type)) {
      return res.status(400).json({success: false, message: 'Invalid field type, must be one of: (TEXT, EMAIL, NUMBER, TEXTAREA, DROPDOWN, CHECKBOX, RADIO, DATE)' });
    }

    const user = await prisma.user.findUnique({ where: { userId } });

    if (!user) {
      return res.status(404).json({ success: false,message: 'User not found' });
    }

    const masterField = await prisma.masterField.create({
      data: {
        label,
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
    res.status(500).json({success: false, message: 'Failed to create master field', error: error.message });
  }
});


// ============================
// READ all Master Fields by User
// ============================
router.get('/api/dashboard/master-fields',[protect], async (req, res) => {
  try {
    const { userId } = req.user;
    if (!userId) {
      return res.status(400).json({ success: false,message: 'User ID is required' });
    }
    const masterFields = await prisma.masterField.findMany({
      where: { userId }
    });

    if (masterFields.length === 0) {
      return res.status(404).json({ success: false, message: 'Master fields not found' });
    }


    res.status(200).json({
      success: true,
      message: 'Master fields fetched successfully',
      data: masterFields
    });
  } catch (error) {
    res.status(500).json({success: false, message: 'Failed to fetch master fields', error: error.message });
  }
});


// ============================
// READ single Master Field by ID
// ============================
router.get('/api/dashboard/master-fields/:masterFieldId', [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { masterFieldId } = req.params;

    const masterField = await prisma.masterField.findUnique({
      where: { masterFieldId: masterFieldId }
    });

    if (!masterField) {
      return res.status(404).json({ success: false,message: 'Master field not found' });
    }

    if( masterField.userId !== userId ) {
      return res.status(403).json({success: false,message: 'You are not authorized to view this master field' });
    }


    res.status(200).json({
      success: true,
      message: 'Master field fetched successfully',
      data: masterField
    });
  } catch (error) {
    res.status(500).json({ success: false,message: 'Failed to fetch master field', error: error.message });
  }
});


// ============================
// UPDATE Master Field
// ============================
router.put('/api/dashboard/master-fields/:masterFieldId', [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { masterFieldId } = req.params;
    const { label, type , options } = req.body;
    if( !masterFieldId ) {
      return res.status(400).json({ success: false, message: 'Master field ID is required' });
    }
    if (!label || !type) {
      return res.status(400).json({ success: false,message: 'Missing required fields' });
    }

    if (!['TEXT', 'EMAIL', 'NUMBER', 'TEXTAREA', 'DROPDOWN', 'CHECKBOX', 'RADIO', 'DATE'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Invalid field type must be one of: (TEXT, EMAIL, NUMBER, TEXTAREA, DROPDOWN, CHECKBOX, RADIO, DATE)' });
    }

    if(type === 'TEXTAREA' || type === 'TEXT' || type === 'EMAIL' || type === 'NUMBER' || type === 'DATE') {
      if(options) {
        return res.status(400).json({ success: false, message: `Cannot set options for field type ${type}` });
      }
    }


    if(type === 'DROPDOWN' || type === 'CHECKBOX' || type === 'RADIO') {
      if(!options || !Array.isArray(options) || options.length === 0) {
        return res.status(400).json({ success: false, message: `Options are required for field type ${type} and must be a non-empty array.` });
      }
    }




    const masterField = await prisma.masterField.findUnique({
      where: { masterFieldId: masterFieldId }
    });

    if (!masterField) {
      return res.status(404).json({success: false, message: 'Master field not found' });
    }

    if( masterField.userId !== userId ) {
      return res.status(403).json({success: false,message: 'You are not authorized to update this master field' });
    }

    const updated = await prisma.masterField.update({
      where: { masterFieldId: masterFieldId },
      data: {
        label,
        type,
        options: options || null
      }
    });

    res.status(200).json({
      success: true,
      message: 'Master field updated successfully',
      data: updated
    });
  } catch (error) {
    res.status(404).json({success: false,message: 'Master field not found or update failed' });
  }
});


// ============================
// DELETE Master Field
// ============================
router.delete('/api/dashboard/master-fields/:masterFieldId', [protect],async (req, res) => {
  try {
    const { userId } = req.user;
    const { masterFieldId } = req.params;

    if( !masterFieldId ) {
      return res.status(400).json({ success: false,message: 'Master field ID is required' });
    }


    const masterField = await prisma.masterField.findUnique({
      where: { masterFieldId: masterFieldId }
    });

    if (!masterField) {
      return res.status(404).json({success: false,message: 'Master field not found' });
    }

    if( masterField.userId !== userId ) {
      return res.status(403).json({ success: false,message: 'You are not authorized to delete this master field' });
    }

    await prisma.masterField.delete({
      where: { masterFieldId }
    });



    res.status(200).json({success: true, message: 'Master field deleted successfully' });

  } catch (error) {
    res.status(404).json({ success: false,message: 'Master field not found' });
  }
});

export default router;

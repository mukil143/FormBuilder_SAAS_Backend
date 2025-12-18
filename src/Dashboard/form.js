import express from 'express';
import { prisma } from '../config/db.js';
const router = express.Router();
/**
 * CREATE FORM
 */
router.post('/api/dashboard/form', async (req, res) => {
  try {
    const { title, description, isPublic, userId , fields } = req.body;

    if (!title || !userId) {
      return res.status(400).json({
        success: false,
        message: 'title and userId are required'
      });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const form = await prisma.form.create({
      data: {
        title,
        description,
        slug,
        isPublic: isPublic ?? false,
        userId,
        formField:{
          create: fields?.map((field,idx)=>({
            label:field.label,
            required:field.required ?? false,
            order: idx,
            type: field.type,
            options: Array.isArray(field.options) ?
              field.options : [],
            masterFieldId: field.masterFieldId || null
          }))
        }
      },
      include:{
        formField:true
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Form created successfully',
      data: form
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});



/**
 * GET Forms by User ID
 */

router.get('/api/dashboard/form/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const forms = await prisma.form.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!forms) {
      return res.status(404).json({
        success: false,
        message: 'No forms found for the user'
      });
    }

    return res.status(200).json({
      success: true,
      count: forms.length,
      data: forms
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * UPDATE FORM
 */

router.put('/api/dashboard/form/:formId', async (req, res) => {
  try {
    const { formId } = req.params;
    const { title, description, isPublic } = req.body;

    const updatedForm = await prisma.form.update({
      where: { formId },
      data: {
        title,
        description,
        isPublic
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Form updated successfully',
      data: updatedForm
    });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: 'Form not found'
    });
  }
});

/**
 * DELETE FORM
 */

router.delete('/api/dashboard/form/:formId', async (req, res) => {
  try {
    const { formId } = req.params;


    const form = await prisma.form.findUnique({
      where: { formId }
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: 'Form not found'
      });
    }

    await prisma.form.delete({
      where: { formId }
    });

    return res.status(200).json({ success: true,  message: 'Form deleted successfully'});
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: 'Form not found'
    });
  }
});



/**
 * Get the Form submitted responses by formId
 * GET /api/dashboard/form/responses/:formId
 */
router.get('/api/dashboard/form/responses/:formId', async (req, res) => {
  try {
    const { formId } = req.params;

    if (!formId) {
      return res.status(400).json({ message: 'formId is required' });
    }

    const form = await prisma.form.findUnique({
      where: { formId: formId },
      include: { formResponse: true }
    });

    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }

    return res.status(200).json({
      success: true,
      data: form.formResponse
    });



  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});


/**
 * Get single Form submitted response by responseId
 * GET /api/dashboard/form/response/:responseId
 */
router.get('/api/dashboard/form/response/:responseId', async (req, res) => {
  try {
    const { responseId } = req.params;

    if (!responseId) {
      return res.status(400).json({ message: 'responseId is required' });
    }
    const response = await prisma.formResponse.findUnique({
      where: { formResponseId: responseId },
      include: { responseValue : true }
    })

    if (!response) {
      return res.status(404).json({ message: 'Form response not found' });
    }
    return res.status(200).json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
})





export default router;

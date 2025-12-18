import express from 'express';
import { prisma } from '../config/db.js';
const router = express.Router();




/**
 * GET Form by Slug
 * GET /api/dashboard/public/form/:slug
 */
router.get('/api/dashboard/public/form/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    // Find form by slug
    const form = await prisma.form.findUnique({
      where: { slug },
      include: { formField: true }
    });
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }
    return res.status(200).json({
      success: true,
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
 * submit form response slug
 * POST /api/dashboard/public/submit/:slug
 * Body: { responses: [...] }
 * Responses is an array of objects with fieldId and value
 */

router.post('/api/dashboard/public/form/submit/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { responses,userId } = req.body;
    // Find form by slug
    const form = await prisma.form.findUnique({
      where: { slug },
      include: { formField: true }
    });
    if (!form) {
      return res.status(404).json({ message: 'Form not found' });
    }


    if(!form.isPublic){
      return res.status(403).json({ message: 'Form is not public' });
    }
    // Create form response
    const submission = await prisma.formResponse.create({
      data:{
        formId: form.formId,
        userId: userId || null,
        responseValue:{
          create: responses.map((response)=>({
            formFieldId: response.formFieldId,
            value: response.value ? response.value : '',
          }))
        }
      },
      include:{
        responseValue:true
      }
    })
    return res.status(201).json({
      success: true,
      message: 'Form submitted successfully',
      data: submission
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success : false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// /**
//  * Modify the answes of a form response
//  * PUT /api/dashboard/public/modify/:formResponseId
//  * Body: { responses: [...] }
//  * Responses is an array of objects with fieldId and value
//  */

// router.put('/api/dashboard/public/form/modify/:formResponseId', async (req, res) => {
//   const { formResponseId } = req.params;
//   const { responses } = req.body;

//   try {
//     // Check if form response exists
//     const existingResponse = await prisma.formResponse.findUnique({
//       where: { formResponseId },
//       include: { responseValue: true }
//     });
//     if (!existingResponse) {
//       return res.status(404).json({ message: 'Form response not found' });
//     }

//     // Update each response value
//     for (const response of responses) {
//      const updated =await prisma.responseValue.updateMany({
//         where: {
//           formResponseId,
//           formFieldId: response.formFieldId
//         },
//         data: {
//           value: response.value
//         }

//     });
//     return res.status(200).json({
//       success: true,
//       message: 'Form responses updated successfully',
//       data: updated
//     });
//   }
//   } catch (error) {
//     console.error(error);
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       error: error.message
//     });
//   }
// }
// );





export default router;

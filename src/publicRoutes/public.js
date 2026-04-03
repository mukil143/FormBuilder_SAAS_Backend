import express from "express";
import { prisma } from "../config/db.js";
import { formSubmitLimiter } from "../Middleware/rateLimitMiddleware.js";
const router = express.Router();

/**
 * GET Form by Slug
 * GET /api/public/form/:slug
 */
router.get("/api/public/form/:slug", async (req, res) => {
  try {
    const { slug } = req.params;

    // Find form by slug
    const form = await prisma.form.findUnique({
      where: { slug: slug.toLowerCase() },
      include: { formField: true },
    });
    if (form === null || form === undefined) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    if (!form.isPublic) {
      return res
        .status(403)
        .json({ success: false, message: "Form is not public" });
    }

    return res.status(200).json({
      success: true,
      data: form,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * submit form response slug
 * POST /api/public/submit/:slug
 * Body: { responses: [...] }
 * Responses is an array of objects with fieldId and value
 */
router.post(
  "/api/public/form/submit/:slug",
  [formSubmitLimiter],
  async (req, res) => {
    try {
      const { slug } = req.params;
      const { responses } = req.body;

      if (!responses || !Array.isArray(responses)) {
        return res.status(400).json({
          success: false,
          message: "Invalid responses",
        });
      }

      // ✅ 1. Get form
      const form = await prisma.form.findUnique({
        where: { slug },
      });

      if (!form) {
        return res.status(404).json({ message: "Form not found" });
      }

      if (!form.isPublic) {
        return res.status(403).json({ message: "Form is not public" });
      }

      const userId = form.userId;

      // ✅ 2. Get user's active subscription
      const subscription = await prisma.subscription.findFirst({
        where: {
          userId,
          status: "active",
        },
        include: {
          planDetails: true,
        },
      });

      let plan;

      if (subscription) {
        plan = subscription.planDetails;
      } else {
        // ✅ FREE fallback
        plan = await prisma.plan.findFirst({
          where: {
            planType: "FREE",
            isActive: true,
          },
        });
      }

      if (!plan) {
        return res.status(500).json({
          success: false,
          message: "Plan not configured",
        });
      }

      // ✅ 3. Get user usage
      const user = await prisma.user.findUnique({
        where: { userId },
        select: {
          monthlyResponseCount: true,
          dailyResponseCount: true,
        },
      });

      // ✅ 4. CHECK LIMITS (🔥 CORE LOGIC)

      if (
        plan.monthlyResponseLimit > 0 &&
        user.monthlyResponseCount >= plan.monthlyResponseLimit
      ) {
        return res.status(403).json({
          success: false,
          message: "Monthly response limit exceeded",
        });
      }

      if (
        plan.dailyResponseLimit > 0 &&
        user.dailyResponseCount >= plan.dailyResponseLimit
      ) {
        return res.status(403).json({
          success: false,
          message: "Daily response limit exceeded",
        });
      }

      // ✅ 5. Save submission
      const submission = await prisma.formResponse.create({
        data: {
          formId: form.formId,
          responseValue: {
            create: responses.map((response) => ({
              formFieldId: response.formFieldId,
              value: response.value || "",
            })),
          },
        },
        include: {
          responseValue: true,
        },
      });

      // ✅ 6. Increment usage
      await prisma.user.update({
        where: { userId },
        data: {
          monthlyResponseCount: { increment: 1 },
          dailyResponseCount: { increment: 1 }, // 🔥 IMPORTANT
        },
      });

      return res.status(201).json({
        success: true,
        message: "Form submitted successfully",
        data: submission,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
);

// /**
//  * Modify the value of a form response
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

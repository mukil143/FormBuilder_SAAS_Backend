import express from "express";
import { prisma } from "../config/db.js";
import { protect } from "../Middleware/authMiddleware.js";
import { trackActivity } from "../Middleware/activityMiddleware.js";
const router = express.Router();
/**
 * CREATE FORM
 */
router.post(
  "/api/dashboard/form",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId, role } = req.user;
      const { title, description, isPublic, fields, theme } = req.body;

      if(role === 'ADMIN'){
        return res.status(403).json({
          success: false,
          message: "Admins are not allowed to create forms",
        });
      }


      if (!title || !userId) {
        return res.status(400).json({
          success: false,
          message: "title and userId are required",
        });
      }

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const form = await prisma.form.create({
        data: {
          title,
          description,
          slug,
          isPublic: isPublic ?? false,
          userId,
          sharedUrl: `${process.env.FRONTEND_URL}public/form/${slug}`,
          formField: {
            create: fields?.map((field, idx) => ({
              label: field.label,
              required: field.required ?? false,
              order: idx,
              type: field.type,
              options: Array.isArray(field.options) ? field.options : [],
              masterFieldId: field.masterFieldId || null,
            })),
          },
          theme: theme || {},
        },
        include: {
          formField: true,
        },
      });

      return res.status(201).json({
        success: true,
        message: "Form created successfully",
        data: form,
      });
    } catch (error) {
      console.error(error);
      if (error.code === "P2002") {
        return res.status(400).json({
          success: false,
          message: "Form with this title already exists",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * GET Forms by User ID
 * GET /api/dashboard/forms
 */

router.get(
  "/api/dashboard/forms",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;

      const forms = await prisma.form.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      if (!forms) {
        return res.status(404).json({
          success: false,
          message: "No forms found for the user",
        });
      }

      return res.status(200).json({
        success: true,
        count: forms.length,
        data: forms,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * UPDATE FORM
 */

// router.put("/api/dashboard/form/:formId", [protect],async (req, res) => {
//   try {
//     const { userId } = req.user;
//     const { formId } = req.params;
//     console.log(req.params);
//     const { title, description, isPublic, fields } = req.body;
//     if (!formId) {
//       return res
//         .status(400)
//         .json({ success: false, message: "formId is required" });
//     }

//     if (Array.isArray(fields)) {
//       for (const field of fields) {
//         if (["DROPDOWN", "CHECKBOX", "RADIO"].includes(field.type)) {
//           // ❌ ERROR: If options is undefined OR not an array OR empty
//           if (
//             !field.options ||
//             !Array.isArray(field.options) ||
//             field.options.length === 0
//           ) {
//             return res.status(400).json({
//               success: false,
//               message: `Options are required for field type ${field.type} and must be a non-empty array.`,
//             });
//           }
//         }
//       }
//     }

//     const form = await prisma.form.findUnique({ where: { formId } });

//     if (form === null || form === undefined) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Form not found" });
//     }

//     if (form.userId !== userId) {
//       return res
//         .status(401)
//         .json({ success: false, message: "Not authorized" });
//     }

//     const slug = title
//       .toLowerCase()
//       .replace(/[^a-z0-9]+/g, "-")
//       .replace(/(^-|-$)/g, "");

//     // 1. Prepare the operations array for the transaction
//     const transactionOperations = [];

//     // 2. Add Form Update Operation
//     transactionOperations.push(
//       prisma.form.update({
//         where: { formId },
//         data: {
//           title,
//           description,
//           isPublic,
//           slug,
//           sharedUrl: `https://formbuilder-saas-backend.onrender.com/api/dashboard/public/form/${slug}`,
//         },
//       })
//     );

//     // 3. Handle Fields Logic (Delete + Create)
//     if (Array.isArray(fields)) {
//       // Step A: Delete existing fields
//       transactionOperations.push(
//         prisma.formField.deleteMany({ where: { formId } })
//       );

//       // Step B: Create new fields
//       if (fields.length > 0) {
//         const newFieldsData = fields.map((field, idx) => ({
//           formFieldId: field.formFieldId ? field.formFieldId : undefined  , // Optional: If you want to keep the same IDs
//           label: field.label,
//           required: field.required ?? false,
//           order: idx,
//           type: field.type,
//           options: Array.isArray(field.options) ? field.options : [],
//           formId: formId, // Link to the form
//           masterFieldId: field.masterFieldId || null,
//         }));

//         transactionOperations.push(
//           prisma.formField.createMany({ data: newFieldsData })
//         );
//       }
//     }

//     // 4. EXECUTE TRANSACTION (All or Nothing)
//     // The result array follows the order of operations pushed above
//     const result = await prisma.$transaction(transactionOperations);

//     // The updated form is the result of the first operation (index 0)
//     const updatedForm = result[0];

//     // 5. Fetch the final result with fields to return to the user
//     // (Optional: You can skip this if you don't need to return the full object immediately)
//     const finalForm = await prisma.form.findUnique({
//       where: { formId },
//       include: { formField: { orderBy: { order: "asc" } } },
//     });

//     return res.status(200).json({
//       success: true,
//       message: "Form updated successfully",
//       data: finalForm,
//     });
//   } catch (error) {
//     console.error("Update Error:", error); // 👈 THIS shows you the real problem in terminal

//     // Handle specific Prisma errors if needed
//     if (error.code === "P2025") {
//       return res
//         .status(404)
//         .json({ success: false, message: "Form ID not found" });
//     }

//     return res.status(500).json({
//       success: false,
//       message: "Failed to update form",
//       error: error.message, // Return the actual error message
//     });
//   }
// });
router.put(
  "/api/dashboard/form/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { formId } = req.params;
      const { title, description, isPublic, fields } = req.body;

      if (!formId) {
        return res
          .status(400)
          .json({ success: false, message: "formId is required" });
      }

      // --- Validation Logic (Same as yours) ---
      if (Array.isArray(fields)) {
        for (const field of fields) {
          if (["DROPDOWN", "CHECKBOX", "RADIO"].includes(field.type)) {
            if (
              !field.options ||
              !Array.isArray(field.options) ||
              field.options.length === 0
            ) {
              return res.status(400).json({
                success: false,
                message: `Options are required for field type ${field.type} and must be a non-empty array.`,
              });
            }
          }
        }
      }

      // --- Authorization Check ---
      const form = await prisma.form.findUnique({ where: { formId } });
      if (!form)
        return res
          .status(404)
          .json({ success: false, message: "Form not found" });
      if (form.userId !== userId)
        return res
          .status(401)
          .json({ success: false, message: "Not authorized" });

      const slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      // 1. Prepare Transaction
      const transactionOperations = [];

      // 2. Update Form Metadata
      transactionOperations.push(
        prisma.form.update({
          where: { formId },
          data: {
            title,
            description,
            isPublic,
            slug,
            sharedUrl: `${process.env.FRONTEND_URL}public/form/${slug}`,
          },
        })
      );

      // 3. SMART FIELD UPDATE LOGIC
      if (Array.isArray(fields)) {
        // A. Get all currently existing field IDs from DB
        const existingFields = await prisma.formField.findMany({
          where: { formId },
          select: { formFieldId: true },
        });
        const existingFieldIds = existingFields.map((f) => f.formFieldId);

        const incomingFieldIds = []; // To track which IDs we are keeping
        const fieldsToCreate = [];
        const fieldsToUpdate = [];

        // B. Sort incoming fields into "Update" vs "Create"
        fields.forEach((field, idx) => {
          // If field has an ID and that ID exists in DB -> Update it
          if (
            field.formFieldId &&
            existingFieldIds.includes(field.formFieldId)
          ) {
            incomingFieldIds.push(field.formFieldId);
            fieldsToUpdate.push({ ...field, order: idx });
          } else {
            // No ID or ID not found -> Create new
            fieldsToCreate.push({ ...field, order: idx });
          }
        });

        // C. Identify fields to DELETE (Exists in DB but not in incoming request)
        const fieldsToDelete = existingFieldIds.filter(
          (id) => !incomingFieldIds.includes(id)
        );

        // --- Add Operations to Transaction ---

        // Operation: Delete removed fields
        if (fieldsToDelete.length > 0) {
          transactionOperations.push(
            prisma.formField.deleteMany({
              where: {
                formId,
                formFieldId: { in: fieldsToDelete },
              },
            })
          );
        }

        // Operation: Update existing fields (Must be loop of updates)
        fieldsToUpdate.forEach((field) => {
          transactionOperations.push(
            prisma.formField.update({
              where: { formFieldId: field.formFieldId },
              data: {
                label: field.label,
                required: field.required ?? false,
                order: field.order,
                type: field.type,
                options: Array.isArray(field.options) ? field.options : [],
                masterFieldId: field.masterFieldId || null,
              },
            })
          );
        });

        // Operation: Create new fields
        if (fieldsToCreate.length > 0) {
          const newFieldsData = fieldsToCreate.map((field) => ({
            label: field.label,
            required: field.required ?? false,
            order: field.order,
            type: field.type,
            options: Array.isArray(field.options) ? field.options : [],
            formId: formId,
            masterFieldId: field.masterFieldId || null,
          }));

          transactionOperations.push(
            prisma.formField.createMany({ data: newFieldsData })
          );
        }
      }

      // 4. Execute Transaction
      await prisma.$transaction(transactionOperations);

      // 5. Return Result
      const finalForm = await prisma.form.findUnique({
        where: { formId },
        include: { formField: { orderBy: { order: "asc" } } },
      });

      return res.status(200).json({
        success: true,
        message: "Form updated successfully",
        data: finalForm,
      });
    } catch (error) {
      console.error("Update Error:", error);
      if (error.code === "P2025") {
        return res
          .status(404)
          .json({ success: false, message: "Record not found" });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to update form",
        error: error.message,
      });
    }
  }
);

/**
 * GET FORM BY ID
 * GET /api/dashboard/form/details/:formId
 * Returns form details along with its fields
 */
router.get(
  "/api/dashboard/form/details/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { formId } = req.params;

      const form = await prisma.form.findUnique({
        where: { formId },
        include: { formField: true },
      });

      if (form === null || form === undefined) {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }

      if (form.userId !== userId) {
        return res.status(401).json({
          success: false,
          message: "Not authorized",
        });
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
  }
);

/**
 * DELETE FORM
 */

router.delete(
  "/api/dashboard/form/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { formId } = req.params;
      if (!formId) {
        return res.status(400).json({
          success: false,
          message: "formId is required",
        });
      }

      await prisma.form.delete({
        where: { formId },
      });

      return res
        .status(200)
        .json({ success: true, message: "Form deleted successfully" });
    } catch (error) {
      if (error.code === "P2025") {
        return res.status(404).json({
          success: false,
          message: "Form not found",
        });
      }
      console.error(error);
      return res.status(404).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
);

/**
 * Get the Form submitted responses by formId
 * GET /api/dashboard/form/responses/:formId
 */
router.get(
  "/api/dashboard/form/responses/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { formId } = req.params;

      if (!formId) {
        return res.status(400).json({ message: "formId is required" });
      }

      const form = await prisma.form.findUnique({
        where: { formId: formId },
        include: { formResponse: true },
      });

      if (form === null || form === undefined) {
        return res.status(404).json({ message: "Form not found" });
      }

      if (form.userId !== userId) {
        return res.status(401).json({ message: "Not authorized" });
      }

      return res.status(200).json({
        success: true,
        data: form.formResponse,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * Get single Form submitted response by responseId
 * GET /api/dashboard/form/response/:responseId
 */
router.get(
  "/api/dashboard/form/response/:responseId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { responseId } = req.params;

      if (!responseId) {
        return res.status(400).json({ message: "responseId is required" });
      }
      const response = await prisma.formResponse.findUnique({
        where: { formResponseId: responseId },
        include: {
          form: {
            select: {
              userId: true,
              title: true,
            },
          },
          responseValue: {
            include: {
              formField: {
                select: {
                  label: true,
                  type: true,
                  options: true,
                  order: true,
                  required: true,
                  masterFieldId: true,
                },
              },
            },
            orderBy: {
              formField: {
                order: "asc",
              },
            },
          },
        },
      });

      if (response === null || response === undefined) {
        return res.status(404).json({ message: "Form response not found" });
      }

      if (response.form.userId !== userId) {
        return res.status(401).json({ message: "Not authorized" });
      }
      return res.status(200).json({
        success: true,
        data: response,
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  }
);

/**
 * Get Form Statistics by formId
 * GET /api/dashboard/form/stats/:formId
 *
 */
// router.get(
//   "/api/dashboard/form/stats/:formId",
//   [protect, trackActivity],
//   async (req, res) => {
//     try {
//       const { userId } = req.user;
//       const { formId } = req.params;

//       if (!formId) {
//         return res.status(400).json({ message: "formId is required" });
//       }

//       const form = await prisma.form.findUnique({
//         where: { formId: formId },
//         include: { formResponse: true },
//       });

//       if (form === null || form === undefined) {
//         return res.status(404).json({ message: "Form not found" });
//       } else if (form.userId !== userId) {
//         return res.status(401).json({ message: "Not authorized" });
//       }

//       return res.status(200).json({
//         success: true,
//         data: {
//           totalResponses: form.formResponse.length,
//         },
//       });
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error: error.message,
//       });
//     }
//   }
// );

/**
 * Update Form Theme
 * PUT /api/dashboard/form/theme/:formId
 * Body: { theme: { ... } }
 * Theme is a JSON object with customization settings
 */
router.put(
  "/api/dashboard/form/theme/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { formId } = req.params;
      const { theme } = req.body;
      if (!formId) {
        return res
          .status(400)
          .json({ success: false, message: "formId is required" });
      }

      const form = await prisma.form.findUnique({
        where: { formId },
      })
      if (form === null || form === undefined) {
        return res
          .status(404)
          .json({ success: false, message: "Form not found" });
      } else if (form.userId !== userId) {
        return res
          .status(401)
          .json({ success: false, message: "Not authorized" });
      }
      const updatedForm = await prisma.form.update({
        where: { formId },
        data: {
          theme: theme ?? {},
        },
      });
      if (updatedForm) {
        return res.status(200).json({
          success: true,
          message: "Form theme updated successfully",
          data: updatedForm,
        });
      } else {
        return res.status(500).json({
          success: false,
          message: "Failed to update form theme",
        });
      }
    } catch (error) {
      console.error("Update Theme Error:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to update form theme",
        error: error.message,
      });
    }
  }
);

export default router;

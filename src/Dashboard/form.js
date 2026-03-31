import express from "express";
import { prisma } from "../config/db.js";
import { checkAccountStatus, checkAPIAccess, checkFormList } from "../Middleware/accessGuard.js";
import { trackActivity } from "../Middleware/activityMiddleware.js";
import { protect } from "../Middleware/authMiddleware.js";
import { generateApiKeys } from "../utils/generateKeys.js";
const router = express.Router();

const isEligibleForTheme = (plan) => {
  return plan !== "FREE";
};

/**
 * CREATE FORM
 */

router.post(
  "/api/dashboard/form",
  [protect,checkAccountStatus, checkFormList, trackActivity],
  async (req, res) => {
    try {
      const { userId, role, plan } = req.user;
      const { title, description, isPublic, fields, theme } = req.body;

      if (role === "ADMIN") {
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
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/(^-|-$)/g, "");

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
          theme: isEligibleForTheme(plan) ? theme : {},
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
  },
);

/**
 * GET Forms by User ID
 * GET /api/dashboard/forms
 */

router.get(
  "/api/dashboard/forms",
  [protect, checkAccountStatus, trackActivity],
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
  },
);

/**
 * UPDATE FORM
 */

/**
 * UPDATE FORM
 * PUT /api/dashboard/form/:formId
 * Body: { title, description, isPublic, fields }
 */
router.put(
  "/api/dashboard/form/:formId",
  [protect, trackActivity],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { formId } = req.params;
      const { title, description, isPublic, fields } = req.body;

      if (formId === null || formId === undefined) {
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
        }),
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
          (id) => !incomingFieldIds.includes(id),
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
            }),
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
            }),
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
            prisma.formField.createMany({ data: newFieldsData }),
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
  },
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
  },
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
  },
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
      const { formId } = req.params;
      const userId = req.user.userId;

      // 1. Verify Ownership first
      const form = await prisma.form.findUnique({ where: { formId } });
      if (!form || form.userId !== userId) {
        return res
          .status(404)
          .json({ success: false, message: "Form not found" });
      }

      // STEP 1: Fetch Form Structure (Your Table Headers)
      // We strictly order fields so columns align correctly
      const formStructure = await prisma.form.findUnique({
        where: { formId },
        select: {
          title: true,
          formField: {
            orderBy: { order: "asc" }, // Critical for column order
            select: {
              formFieldId: true,
              label: true,
              type: true,
            },
          },
        },
      });

      if (!formStructure)
        return res.status(404).json({ message: "Form not found" });

      // STEP 2: Fetch Responses (Your Table Rows)
      // We ONLY fetch the values, not the question labels again
      const rawResponses = await prisma.formResponse.findMany({
        where: { formId },
        orderBy: { createdAt: "desc" },
        select: {
          formResponseId: true,
          createdAt: true,
          responseValue: {
            select: {
              formFieldId: true,
              value: true,
            },
          },
        },
      });

      // STEP 3: Transform Data for Frontend Table
      // Convert the "Array of Objects" into a "Single Flat Object" per row
      const tableRows = rawResponses.map((response) => {
        const rowObject = {
          id: response.formResponseId,
          submittedAt: response.createdAt,
        };

        // Map answers to their field IDs (or Labels)
        response.responseValue.forEach((answer) => {
          rowObject[answer.formFieldId] = answer.value;
        });

        return rowObject;
      });

      // STEP 4: Send Clean JSON
      res.json({
        success: true,
        data: {
          formTitle: formStructure.title,
          // Columns: Use this to generate <th>
          columns: formStructure.formField.map((field) => ({
            key: field.formFieldId, // This matches the key in rowObject
            label: field.label,
            type: field.type,
          })),
          // Rows: Use this to generate <tr>
          rows: tableRows,
        },
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
);

/**
 * Get single Form submitted response by responseId
 * GET /api/dashboard/form/response/:responseId
 */
// router.get(
//   "/api/dashboard/form/response/:responseId",
//   [protect, trackActivity],
//   async (req, res) => {
//     try {
//       const { userId } = req.user;
//       const { responseId } = req.params;

//       if (!responseId) {
//         return res.status(400).json({ message: "responseId is required" });
//       }
//       const response = await prisma.formResponse.findUnique({
//         where: { formResponseId: responseId },
//         include: {
//           form: {
//             select: {
//               userId: true,
//               title: true,
//             },
//           },
//           responseValue: {
//             include: {
//               formField: {
//                 select: {
//                   label: true,
//                   type: true,
//                   options: true,
//                   order: true,
//                   required: true,
//                   masterFieldId: true,
//                 },
//               },
//             },
//             orderBy: {
//               formField: {
//                 order: "asc",
//               },
//             },
//           },
//         },
//       });

//       if (response === null || response === undefined) {
//         return res.status(404).json({ message: "Form response not found" });
//       }

//       if (response.form.userId !== userId) {
//         return res.status(401).json({ message: "Not authorized" });
//       }
//       return res.status(200).json({
//         success: true,
//         data: response,
//       });
//     } catch (error) {
//       console.error(error);
//       return res.status(500).json({
//         success: false,
//         message: "Internal server error",
//         error: error.message,
//       });
//     }
//   },
// );

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
      const { userId, plan} = req.user;
      const { formId } = req.params;
      const { theme } = req.body;
      if (!formId) {
        return res
          .status(400)
          .json({ success: false, message: "formId is required" });
      }

      const form = await prisma.form.findUnique({
        where: { formId },
      });
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
          theme: isEligibleForTheme(plan) ? theme : {},
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
  },
);
/**
 * Generate API Keys for the logged-in user
 * POST /api/dashboard/keys
 * Body: { name: "My Key" } (optional)
 */
router.post(
  "/api/dashboard/keys",
  [protect, checkAPIAccess],
  async (req, res) => {
    try {
      const { userId } = req.user;
      const { name } = req.body; // e.g., "My E-commerce Site"

      const existingKeys = await prisma.apiKey.findMany({
        where: { userId },
      });

      if (existingKeys.length >= 5) {
        return res.status(400).json({
          success: false,
          message: "API Key limit reached. Maximum 5 keys allowed per user.",
        });
      }

      const keyName = name || "Default Key";
      const nameExists = existingKeys.some((k) => k.name === keyName);
      if (nameExists) {
        return res.status(400).json({
          success: false,
          message: `You already have a key named "${keyName}". Please choose a different name.`,
        });
      }

      // 1. Generate keys
      const { rawKey, rawSecret, hashedSecret } = await generateApiKeys();

      // 2. Save public key + hashed secret to DB
      await prisma.apiKey.create({
        data: {
          userId,
          key: rawKey,
          secret: hashedSecret,
          name: keyName || "Default Key",
        },
      });

      // 3. Return RAW keys to user (Critical: This is the only time they see the secret)
      res.status(201).json({
        success: true,
        message:
          "API Key generated successfully Store the secret key securely! You won't be able to see it again.",
        data: {
          publicKey: rawKey,
          secretKey: rawSecret, // ⚠️ Warn user to copy this now!
        },
      });
    } catch (error) {
      console.error(error);
      res
        .status(500)
        .json({ success: false, message: "Failed to generate keys" });
    }
  },
);

/**
 * Get API Keys for the logged-in user
 * GET /api/dashboard/keys
 */
router.get("/api/dashboard/keys", [protect], async (req, res) => {
  try {
    const { userId } = req.user;

    const keys = await prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, // Needed for the Delete button
        name: true, // e.g. "Production App"
        key: true, // The Public Key (pk_live_...)
        lastUsed: true, // "Last seen 2 mins ago"
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: keys || [],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to fetch keys" });
  }
});

/**
 * Delete API Key
 * DELETE /api/dashboard/keys/:id
 */
router.delete("/api/dashboard/keys/:id", [protect], async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "id is required" });
    }

    const key = await prisma.apiKey.findUnique({ where: { id: id } });
    if (!key) {
      return res.status(404).json({ success: false, message: "Key not found" });
    }

    if (key.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this key",
      });
    }
    await prisma.apiKey.delete({ where: { id: id } });
    res
      .status(200)
      .json({ success: true, message: "Key deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Failed to delete key" });
  }
});

export default router;

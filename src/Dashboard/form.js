import express from "express";
import { prisma } from "../config/db.js";
const router = express.Router();
/**
 * CREATE FORM
 */
router.post("/api/dashboard/form", async (req, res) => {
  try {
    const { title, description, isPublic, userId, fields } = req.body;

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
        sharedUrl: `https://formbuilder-saas-backend.onrender.com/api/dashboard/public/form/${slug}`,
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
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
});

/**
 * GET Forms by User ID
 */

router.get("/api/dashboard/form/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

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
});

/**
 * UPDATE FORM
 */

router.put("/api/dashboard/form/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const { title, description, isPublic, fields } = req.body;
    if (!formId) {
      return res
        .status(400)
        .json({ success: false, message: "formId is required" });
    }

    if (Array.isArray(fields)) {
      for (const field of fields) {
        if (["DROPDOWN", "CHECKBOX", "RADIO"].includes(field.type)) {
          // ❌ ERROR: If options is undefined OR not an array OR empty
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

    const form = await prisma.form.findUnique({ where: { formId } });
    if (!form) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // 1. Prepare the operations array for the transaction
    const transactionOperations = [];

    // 2. Add Form Update Operation
    transactionOperations.push(
      prisma.form.update({
        where: { formId },
        data: {
          title,
          description,
          isPublic,
          slug,
          sharedUrl: `https://formbuilder-saas-backend.onrender.com/api/dashboard/public/form/${slug}`,
        },
      })
    );

    // 3. Handle Fields Logic (Delete + Create)
    if (Array.isArray(fields)) {
      // Step A: Delete existing fields
      transactionOperations.push(
        prisma.formField.deleteMany({ where: { formId } })
      );

      // Step B: Create new fields
      if (fields.length > 0) {
        const newFieldsData = fields.map((field, idx) => ({
          formFieldId: field.formFieldId, // Optional: If you want to keep the same IDs
          label: field.label,
          required: field.required ?? false,
          order: idx,
          type: field.type,
          options: Array.isArray(field.options) ? field.options : [],
          formId: formId, // Link to the form
          masterFieldId: field.masterFieldId || null,
        }));

        transactionOperations.push(
          prisma.formField.createMany({ data: newFieldsData })
        );
      }
    }

    // 4. EXECUTE TRANSACTION (All or Nothing)
    // The result array follows the order of operations pushed above
    const result = await prisma.$transaction(transactionOperations);

    // The updated form is the result of the first operation (index 0)
    const updatedForm = result[0];

    // 5. Fetch the final result with fields to return to the user
    // (Optional: You can skip this if you don't need to return the full object immediately)
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
    console.error("Update Error:", error); // 👈 THIS shows you the real problem in terminal

    // Handle specific Prisma errors if needed
    if (error.code === "P2025") {
      return res
        .status(404)
        .json({ success: false, message: "Form ID not found" });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update form",
      error: error.message, // Return the actual error message
    });
  }
});

/**
 * GET FORM BY ID
 * GET /api/dashboard/form/details/:formId
 * Returns form details along with its fields
 */
router.get("/api/dashboard/form/details/:formId", async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await prisma.form.findUnique({
      where: { formId },
      include: { formField: true },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
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
});

/**
 * DELETE FORM
 */

router.delete("/api/dashboard/form/:formId", async (req, res) => {
  try {
    const { formId } = req.params;

    const form = await prisma.form.findUnique({
      where: { formId },
    });

    if (!form) {
      return res.status(404).json({
        success: false,
        message: "Form not found",
      });
    }

    await prisma.form.delete({
      where: { formId },
    });

    return res
      .status(200)
      .json({ success: true, message: "Form deleted successfully" });
  } catch (error) {
    return res.status(404).json({
      success: false,
      message: "Form not found",
    });
  }
});

/**
 * Get the Form submitted responses by formId
 * GET /api/dashboard/form/responses/:formId
 */
router.get("/api/dashboard/form/responses/:formId", async (req, res) => {
  try {
    const { formId } = req.params;

    if (!formId) {
      return res.status(400).json({ message: "formId is required" });
    }

    const form = await prisma.form.findUnique({
      where: { formId: formId },
      include: { formResponse: true },
    });

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
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
});

/**
 * Get single Form submitted response by responseId
 * GET /api/dashboard/form/response/:responseId
 */
router.get("/api/dashboard/form/response/:responseId", async (req, res) => {
  try {
    const { responseId } = req.params;

    if (!responseId) {
      return res.status(400).json({ message: "responseId is required" });
    }
    const response = await prisma.formResponse.findUnique({
      where: { formResponseId: responseId },
      include: { responseValue: true },
    });

    if (!response) {
      return res.status(404).json({ message: "Form response not found" });
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
});

export default router;

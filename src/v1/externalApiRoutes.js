import express from "express";
import { prisma } from "../config/db.js"; // Adjust path
import { apiKeyAuth } from "../Middleware/apiAuthkey.js";

const router = express.Router();

// 🔒 Apply API Key Auth to ALL routes in this file
router.use(apiKeyAuth);

// ---------------------------------------------------------
// 1. FETCH FORM (Get structure/questions)
// GET /api/v1/forms/:formId
// ---------------------------------------------------------
router.get("/forms/:formId", async (req, res) => {
  try {
    const { formId } = req.params;
    const userId = req.user.userId; // Populated by apiKeyAuth

    const form = await prisma.form.findUnique({
      where: { formId },
      include: {
        formField: {
          orderBy: { order: "asc" }, // Send questions in correct order
        },
      },
    });

    // Security: Ensure the API key owner actually owns this form
    if (!form || form.userId !== userId) {
      return res
        .status(404)
        .json({ success: false, message: "Form not found" });
    }

    res.json({
      success: true,
      data: {
        formId: form.formId,
        title: form.title,
        fields: form.formField, // They need this to render the form themselves
        theme: form.theme,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ---------------------------------------------------------
// 2. SUBMIT RESPONSE (Server-side submission)
// POST /api/v1/forms/:formId/submit
// ---------------------------------------------------------
router.post("/forms/:formId/submit", async (req, res) => {
  try {
    const { formId } = req.params;
    const { responses } = req.body; // Array of { fieldId, value }

    // Optional: You might want to validate that formId belongs to apiKey owner
    // OR allow submission to ANY public form if you want that behavior.
    // Here, we assume they are submitting data to THEIR own form.

    // 1. Create the main response container
    const newResponse = await prisma.formResponse.create({
      data: {
        formId,
        // 2. Create the nested answer values
        responseValue: {
          create: responses.map((r) => ({
            formFieldId: r.formFieldId,
            value: r.value,
          })),
        },
      },
    });

    res.status(201).json({
      success: true,
      message: "Submission recorded successfully",
      responseId: newResponse.formResponseId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Submission failed" });
  }
});

// ---------------------------------------------------------
// 3. FETCH RESPONSES (Get collected data)
// GET /api/v1/forms/:formId/responses
// ---------------------------------------------------------
router.get("/forms/:formId/responses", async (req, res) => {
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

    if (!formStructure) return res.status(404).json({ message: "Form not found" });

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
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;

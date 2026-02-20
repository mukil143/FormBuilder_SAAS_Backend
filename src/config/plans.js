export const PLAN_LIMITS = {
  FREE: {
    maxForms: 3,
    maxResponses: 100,
    apiAccess: "NONE", // No API access
  },
  PRO: {
    maxForms: Infinity, // Unlimited
    maxResponses: 2000,
    apiAccess: "READ", // Can only fetch data via API
  },
  BUSINESS: {
    maxForms: Infinity, // Unlimited
    maxResponses: 50000,
    apiAccess: "FULL", // Can fetch and submit via API
  },
};

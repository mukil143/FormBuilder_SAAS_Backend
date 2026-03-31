export const PLAN_LIMITS = {
  FREE: {
    maxForms: 3,
    maxResponses: 100,
    apiAccess: "NONE", // No API access
    apiKey : 0
  },
  PRO: {
    maxForms: Infinity, // Unlimited
    maxResponses: 2000,
    apiAccess: "FULL",
    apiKey : 1 // Can only fetch data via API
  },
  BUSINESS: {
    maxForms: Infinity, // Unlimited
    maxResponses: 50000,
    apiAccess: "FULL",
    apiKey : 5 // Can fetch and submit via API
  },
};

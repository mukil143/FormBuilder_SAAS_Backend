// middleware/checkLimit.js

export const checkLimit = (type) => {
  return (req, res, next) => {
    try {
      const user = req.user;
      const plan = req.plan;

      if (!plan) {
        return res.status(500).json({
          success: false,
          message: "Plan not found",
        });
      }

    let allowed = true;

      switch (type) {
        case "FORM_CREATE":
          allowed = user.formCount < plan.activeFormLimit;
          break;

        case "API_KEY":
          allowed = user.apiKeyCount < plan.apiKeyLimit;
          break;

        case "MONTHLY_RESPONSE":
          allowed = user.monthlyResponseCount < plan.monthlyResponseLimit;
          break;

        case "DAILY_RESPONSE":
          allowed = user.dailyResponseCount < plan.dailyResponseLimit;
          break;

        case "USER_LIMIT":
          allowed = user.teamSize < plan.userLimit;
          break;

        case "THEME":
          if (!plan.themeAccess) {
            return res.status(403).json({
              success: false,
              message: "Upgrade plan to access premium themes",
            });
          }
          return next();

        default:
          return next();
      }

      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: "Limit exceeded. Please upgrade your plan.",
        });
      }

      next();
    } catch (error) {
      console.error("Limit Middleware Error:", error);
      res.status(500).json({ success: false });
    }
  };
};

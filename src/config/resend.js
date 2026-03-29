import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendEmail = async ({ to, subject, html }) => {
  const res = await resend.emails.send({
    from: "mukilanmukilan174@gmail.com",
    to,
    subject,
    html,
  });
  console.log("Email sent:", res);
};

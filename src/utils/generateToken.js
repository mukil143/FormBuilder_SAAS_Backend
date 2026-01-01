import jwt from "jsonwebtoken";

 const generateToken = (user) => {
  return jwt.sign({
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role
   }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

export default generateToken;

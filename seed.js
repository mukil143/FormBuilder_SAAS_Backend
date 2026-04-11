import { prisma } from "./src/config/db.js";
import { hashPassword } from "./src/utils/hashPassword.js";

const seed = async () => {
  try {
    const clearData = await prisma.$transaction([
      prisma.formResponse.deleteMany(),
      prisma.form.deleteMany(),
      prisma.user.deleteMany(),
      prisma.subscription.deleteMany(),
      prisma.formField.deleteMany(),
      prisma.apiKey.deleteMany(),
      prisma.masterField.deleteMany(),
      prisma.responseValue.deleteMany(),
      prisma.userReport.deleteMany(),
    ]); // Clear any pending transactions

    console.log("Cleared existing data:", clearData);

    const password = "123456"; // Default password for all users
    const hashedPassword = await hashPassword(password);

    const usersData = [
      {
        name: "Admin",
        email: "admin@gmail.com",
        password: hashedPassword,
        role: "ADMIN",
      },
      {
        name: "User1",
        email: "user1@gmail.com",
        password: hashedPassword,
        role: "USER",
      },
    ];

    for (const user of usersData) {
      await prisma.user.create({
        data: user,
      });
    }
  } catch (error) {
    console.error("Error seeding data:", error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
    console.log("Data seeded successfully");
  }
  // Clear existing data
};

seed();

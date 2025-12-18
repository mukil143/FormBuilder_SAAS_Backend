import {PrismaClient} from '../generated/prisma/index.js'
import { PrismaPg } from '@prisma/adapter-pg'
import "dotenv/config";
import dotenv from 'dotenv';
dotenv.config();

const connectionString = `${process.env.DATABASE_URL}`
console.log(connectionString)
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

export {prisma}

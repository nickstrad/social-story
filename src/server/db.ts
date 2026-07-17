import { PrismaClient } from "@/generated/prisma"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const db = globalForPrisma.prisma ?? new PrismaClient()

globalForPrisma.prisma = db

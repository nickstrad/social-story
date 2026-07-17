import type { Prisma, PrismaClient } from "@/generated/prisma"

export type PrismaDb = PrismaClient | Prisma.TransactionClient

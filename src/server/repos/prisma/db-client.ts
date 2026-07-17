import type { Prisma, PrismaClient } from "@prisma/client"

export type PrismaDb = PrismaClient | Prisma.TransactionClient

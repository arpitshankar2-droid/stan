-- CreateEnum
CREATE TYPE "UniverseStatus" AS ENUM ('BUILDING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "QuoteSource" AS ENUM ('SCRAPED', 'GENERATED', 'MIXED');

-- CreateTable
CREATE TABLE "Universe" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "UniverseStatus" NOT NULL DEFAULT 'BUILDING',
    "source" "QuoteSource",
    "characters" JSONB,
    "tiers" JSONB,
    "failReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Universe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "options" TEXT[],
    "difficulty" INTEGER NOT NULL,
    "source" "QuoteSource" NOT NULL,
    "context" TEXT,
    "quoteHash" TEXT NOT NULL,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Result" (
    "id" TEXT NOT NULL,
    "universeId" TEXT NOT NULL,
    "name" TEXT,
    "score" INTEGER NOT NULL,
    "questionIds" TEXT[],
    "answers" JSONB NOT NULL,
    "tier" TEXT NOT NULL,
    "roast" TEXT NOT NULL,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "challengeOf" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Result_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Universe_slug_key" ON "Universe"("slug");

-- CreateIndex
CREATE INDEX "Question_universeId_difficulty_idx" ON "Question"("universeId", "difficulty");

-- CreateIndex
CREATE UNIQUE INDEX "Question_universeId_quoteHash_key" ON "Question"("universeId", "quoteHash");

-- CreateIndex
CREATE INDEX "Result_universeId_idx" ON "Result"("universeId");

-- CreateIndex
CREATE INDEX "Result_challengeOf_idx" ON "Result"("challengeOf");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Result" ADD CONSTRAINT "Result_universeId_fkey" FOREIGN KEY ("universeId") REFERENCES "Universe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fuzzy fandom matching: "bojack" -> "BoJack Horseman" without a rebuild
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Universe_name_trgm_idx" ON "Universe" USING GIN ("name" gin_trgm_ops);

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { ensureUniqueListSlug, getOrCreateDefaultCollectionList } from "@/lib/collection-lists";

const createListSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await getOrCreateDefaultCollectionList(session.user.id);

  const lists = await db.collectionList.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: {
        select: { items: true },
      },
    },
  });

  return NextResponse.json({
    lists: lists.map((list) => ({
      id: list.id,
      name: list.name,
      slug: list.slug,
      description: list.description,
      isPublic: list.isPublic,
      isDefault: list.isDefault,
      promptCount: list._count.items,
      updatedAt: list.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, isPublic } = createListSchema.parse(body);
    const slug = await ensureUniqueListSlug(session.user.id, name);

    const list = await db.collectionList.create({
      data: {
        userId: session.user.id,
        name,
        slug,
        description: description || null,
        isPublic: isPublic ?? false,
        isDefault: false,
      },
    });

    return NextResponse.json({ list }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Failed to create collection list:", error);
    return NextResponse.json({ error: "Failed to create list" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { collectionPromptInclude, ensureUniqueListSlug } from "@/lib/collection-lists";

const updateListSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isPublic: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const list = await db.collectionList.findFirst({
    where: { id, userId: session.user.id },
    include: {
      items: {
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        include: {
          prompt: {
            include: collectionPromptInclude,
          },
        },
      },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  return NextResponse.json({ list });
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.collectionList.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const data = updateListSchema.parse(body);

    let slug = existing.slug;
    if (data.name && data.name !== existing.name && !existing.isDefault) {
      slug = await ensureUniqueListSlug(session.user.id, data.name);
    }

    const list = await db.collectionList.update({
      where: { id },
      data: {
        ...(data.name !== undefined && !existing.isDefault ? { name: data.name, slug } : {}),
        ...(data.name !== undefined && existing.isDefault ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.isPublic !== undefined ? { isPublic: data.isPublic } : {}),
      },
    });

    return NextResponse.json({ list });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Failed to update collection list:", error);
    return NextResponse.json({ error: "Failed to update list" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await db.collectionList.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!existing) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  if (existing.isDefault) {
    return NextResponse.json({ error: "Cannot delete default list" }, { status: 400 });
  }

  await db.collectionList.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}

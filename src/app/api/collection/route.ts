import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import {
  collectionPromptInclude,
  getOrCreateDefaultCollectionList,
  userHasPromptInCollection,
} from "@/lib/collection-lists";

const addToCollectionSchema = z.object({
  promptId: z.string().min(1),
  listId: z.string().min(1).optional(),
});

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const collections = await db.collection.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      list: {
        select: { id: true, name: true, slug: true, isDefault: true },
      },
      prompt: {
        include: collectionPromptInclude,
      },
    },
  });

  return NextResponse.json({ collections });
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { promptId, listId: requestedListId } = addToCollectionSchema.parse(body);

    const list = requestedListId
      ? await db.collectionList.findFirst({
          where: { id: requestedListId, userId: session.user.id },
        })
      : await getOrCreateDefaultCollectionList(session.user.id);

    if (!list) {
      return NextResponse.json({ error: "List not found" }, { status: 404 });
    }

    const existingCollection = await db.collection.findUnique({
      where: {
        listId_promptId: {
          listId: list.id,
          promptId,
        },
      },
    });

    if (existingCollection) {
      return NextResponse.json({ error: "Already in collection" }, { status: 400 });
    }

    const prompt = await db.prompt.findUnique({
      where: { id: promptId },
      select: { id: true, isPrivate: true, authorId: true },
    });

    if (!prompt) {
      return NextResponse.json({ error: "Prompt not found" }, { status: 404 });
    }

    if (prompt.isPrivate && prompt.authorId !== session.user.id) {
      return NextResponse.json({ error: "Cannot add private prompt" }, { status: 403 });
    }

    const collection = await db.collection.create({
      data: {
        listId: list.id,
        userId: session.user.id,
        promptId,
      },
    });

    return NextResponse.json({ collection, added: true, listId: list.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    console.error("Failed to add to collection:", error);
    return NextResponse.json({ error: "Failed to add to collection" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const promptId = searchParams.get("promptId");
    const listId = searchParams.get("listId");

    if (!promptId) {
      return NextResponse.json({ error: "promptId required" }, { status: 400 });
    }

    if (listId) {
      const list = await db.collectionList.findFirst({
        where: { id: listId, userId: session.user.id },
      });
      if (!list) {
        return NextResponse.json({ error: "List not found" }, { status: 404 });
      }
      await db.collection.delete({
        where: {
          listId_promptId: {
            listId,
            promptId,
          },
        },
      });
    } else {
      await db.collection.deleteMany({
        where: {
          userId: session.user.id,
          promptId,
        },
      });
    }

    const stillSaved = await userHasPromptInCollection(session.user.id, promptId);

    return NextResponse.json({ removed: true, inCollection: stillSaved });
  } catch (error) {
    console.error("Failed to remove from collection:", error);
    return NextResponse.json({ error: "Failed to remove from collection" }, { status: 500 });
  }
}

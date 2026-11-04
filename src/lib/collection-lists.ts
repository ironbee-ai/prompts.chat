import { db } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { DEFAULT_COLLECTION_LIST_SLUG } from "@/lib/collection-lists.constants";

const DEFAULT_LIST_NAME = "Saved";

export async function getOrCreateDefaultCollectionList(userId: string) {
  const existing = await db.collectionList.findFirst({
    where: { userId, isDefault: true },
  });
  if (existing) return existing;

  return db.collectionList.create({
    data: {
      userId,
      name: DEFAULT_LIST_NAME,
      slug: DEFAULT_COLLECTION_LIST_SLUG,
      isDefault: true,
      isPublic: false,
    },
  });
}

export async function ensureUniqueListSlug(userId: string, name: string): Promise<string> {
  const base = slugify(name) || "list";
  let suffix = 0;
  while (true) {
    const slug = suffix === 0 ? base : `${base}-${suffix}`;
    const taken = await db.collectionList.findUnique({
      where: { userId_slug: { userId, slug } },
    });
    if (!taken) return slug;
    suffix += 1;
  }
}

export async function userHasPromptInCollection(userId: string, promptId: string) {
  const count = await db.collection.count({
    where: { userId, promptId },
  });
  return count > 0;
}

export const collectionPromptInclude = {
  author: {
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      verified: true,
    },
  },
  category: {
    include: {
      parent: {
        select: { id: true, name: true, slug: true },
      },
    },
  },
  tags: {
    include: { tag: true },
  },
  _count: {
    select: {
      votes: true,
      contributors: true,
      outgoingConnections: { where: { label: { not: "related" } } },
      incomingConnections: { where: { label: { not: "related" } } },
    },
  },
} as const;

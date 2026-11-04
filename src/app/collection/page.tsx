import { Suspense } from "react";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Bookmark, Sparkles } from "lucide-react";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { PromptList } from "@/components/prompts/prompt-list";
import {
  CollectionListsSidebar,
  type CollectionListSummary,
} from "@/components/collection/collection-lists-sidebar";
import {
  collectionPromptInclude,
  getOrCreateDefaultCollectionList,
} from "@/lib/collection-lists";
import type { Metadata } from "next";
import { NOINDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  robots: NOINDEX_ROBOTS,
};

interface CollectionPageProps {
  searchParams: Promise<{ list?: string }>;
}

export default async function CollectionPage({ searchParams }: CollectionPageProps) {
  const t = await getTranslations("collection");
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { list: listSlug } = await searchParams;

  await getOrCreateDefaultCollectionList(session.user.id);

  const listsRaw = await db.collectionList.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    include: {
      _count: { select: { items: true } },
    },
  });

  const lists: CollectionListSummary[] = listsRaw.map((list) => ({
    id: list.id,
    name: list.name,
    slug: list.slug,
    description: list.description,
    isPublic: list.isPublic,
    isDefault: list.isDefault,
    promptCount: list._count.items,
  }));

  const activeList =
    lists.find((l) => l.slug === listSlug) ??
    lists.find((l) => l.isDefault) ??
    lists[0];

  if (!activeList) {
    notFound();
  }

  const collectionsRaw = await db.collection.findMany({
    where: { listId: activeList.id },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    include: {
      prompt: {
        include: collectionPromptInclude,
      },
    },
  });

  const prompts = collectionsRaw
    .filter((c) => c.prompt && !c.prompt.deletedAt)
    .map((c) => ({
      ...c.prompt,
      voteCount: c.prompt._count?.votes ?? 0,
      contributorCount: c.prompt._count?.contributors ?? 0,
    }));

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  });

  return (
    <div className="container py-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/prompts">
              {t("browsePrompts")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/discover">
              <Sparkles className="mr-1.5 h-4 w-4" />
              {t("discover")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Suspense fallback={null}>
            <CollectionListsSidebar
              lists={lists}
              activeListId={activeList.id}
              username={user?.username ?? session.user.username ?? ""}
            />
          </Suspense>
        </aside>

        <div className="min-w-0">
          <div className="mb-4">
            <h2 className="text-base font-semibold">{activeList.name}</h2>
            {activeList.description && (
              <p className="text-sm text-muted-foreground mt-1">{activeList.description}</p>
            )}
            {activeList.isPublic && user?.username && (
              <p className="text-xs text-muted-foreground mt-2">
                {t("publicUrl")}:{" "}
                <Link
                  href={`/@${user.username}/lists/${activeList.slug}`}
                  className="text-primary hover:underline"
                >
                  /@{user.username}/lists/{activeList.slug}
                </Link>
              </p>
            )}
          </div>

          {prompts.length > 0 ? (
            <PromptList prompts={prompts} currentPage={1} totalPages={1} />
          ) : (
            <div className="text-center py-12 border rounded-lg bg-muted/30">
              <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-medium mb-1">
                {activeList.isDefault ? t("emptyTitle") : t("emptyListTitle")}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {activeList.isDefault ? t("emptyDescription") : t("emptyListDescription")}
              </p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/prompts">{t("browsePrompts")}</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

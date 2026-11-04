import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Globe, User } from "lucide-react";
import { db } from "@/lib/db";
import { PromptList } from "@/components/prompts/prompt-list";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { JsonLd, breadcrumbSchema, collectionPageSchema } from "@/components/seo/structured-data";
import { buildPageMetadata } from "@/lib/seo";
import { escapeLikePattern } from "@/lib/utils";
import { collectionPromptInclude } from "@/lib/collection-lists";
import { getPromptUrl } from "@/lib/urls";

interface PublicListPageProps {
  params: Promise<{ username: string; listSlug: string }>;
}

export async function generateMetadata({ params }: PublicListPageProps): Promise<Metadata> {
  const { username: rawUsername, listSlug } = await params;
  const decoded = decodeURIComponent(rawUsername);
  if (!decoded.startsWith("@")) {
    return { title: "Not Found" };
  }
  const username = decoded.slice(1);

  const user = await db.user.findFirst({
    where: { username: { equals: escapeLikePattern(username), mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, username: true },
  });

  if (!user) {
    return { title: "Not Found" };
  }

  const list = await db.collectionList.findFirst({
    where: { userId: user.id, slug: listSlug, isPublic: true },
    select: { name: true, description: true },
  });

  if (!list) {
    return { title: "Not Found" };
  }

  const t = await getTranslations("seo.collectionList");
  const owner = user.name || user.username;

  return buildPageMetadata({
    title: t("title", { name: list.name, owner }),
    description: list.description || t("description", { name: list.name, owner }),
    path: `/@${user.username}/lists/${listSlug}`,
  });
}

export default async function PublicCollectionListPage({ params }: PublicListPageProps) {
  const { username: rawUsername, listSlug } = await params;
  const decoded = decodeURIComponent(rawUsername);

  if (!decoded.startsWith("@")) {
    notFound();
  }

  const username = decoded.slice(1);
  const t = await getTranslations("collection.public");

  const user = await db.user.findFirst({
    where: { username: { equals: escapeLikePattern(username), mode: "insensitive" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      avatar: true,
      verified: true,
    },
  });

  if (!user) {
    notFound();
  }

  const list = await db.collectionList.findFirst({
    where: { userId: user.id, slug: listSlug, isPublic: true },
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
    notFound();
  }

  const prompts = list.items
    .filter(
      (item) =>
        item.prompt &&
        !item.prompt.deletedAt &&
        !item.prompt.isPrivate &&
        !item.prompt.isUnlisted
    )
    .map((item) => ({
      ...item.prompt,
      voteCount: item.prompt._count?.votes ?? 0,
      contributorCount: item.prompt._count?.contributors ?? 0,
    }));

  const ownerName = user.name || user.username;
  const listPath = `/@${user.username}/lists/${list.slug}`;

  return (
    <>
      <JsonLd
        data={[
          collectionPageSchema({
            name: list.name,
            description: list.description || `${ownerName}'s public prompt list`,
            path: listPath,
            items: prompts.slice(0, 20).map((prompt) => ({
              name: prompt.title,
              path: getPromptUrl(prompt.id, prompt.slug),
            })),
          }),
          breadcrumbSchema([
            { name: "Home", path: "/" },
            { name: ownerName, path: `/@${user.username}` },
            { name: list.name, path: listPath },
          ]),
        ]}
      />
      <div className="container py-6 max-w-4xl">
        <div className="mb-6 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary" className="gap-1">
              <Globe className="h-3 w-3" />
              {t("badge")}
            </Badge>
            <span>{t("promptCount", { count: prompts.length })}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{list.name}</h1>
          {list.description && (
            <p className="text-muted-foreground">{list.description}</p>
          )}
          <Link
            href={`/@${user.username}`}
            className="inline-flex items-center gap-2 text-sm hover:text-primary"
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatar ?? undefined} />
              <AvatarFallback>
                <User className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <span>
              {t("by")} <span className="font-medium">@{user.username}</span>
            </span>
          </Link>
        </div>

        {prompts.length > 0 ? (
          <PromptList prompts={prompts} currentPage={1} totalPages={1} />
        ) : (
          <div className="text-center py-12 border rounded-lg bg-muted/30 text-sm text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </div>
    </>
  );
}

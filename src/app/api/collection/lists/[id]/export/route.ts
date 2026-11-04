import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPromptUrl } from "@/lib/urls";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function getSiteOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_SITE_URL ?? "https://prompts.chat";
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  const { id } = await params;
  const format = request.nextUrl.searchParams.get("format") ?? "json";

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
            select: {
              id: true,
              title: true,
              slug: true,
              description: true,
              content: true,
              type: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (!list) {
    return NextResponse.json({ error: "List not found" }, { status: 404 });
  }

  const origin = getSiteOrigin(request);
  const prompts = list.items
    .map((item) => item.prompt)
    .filter((prompt) => prompt && !prompt.deletedAt);

  if (format === "markdown") {
    const lines = [
      `# ${list.name}`,
      "",
      ...(list.description ? [list.description, ""] : []),
      ...prompts.flatMap((prompt) => [
        `## ${prompt.title}`,
        "",
        ...(prompt.description ? [`> ${prompt.description}`, ""] : []),
        prompt.content,
        "",
        `[View on prompts.chat](${origin}${getPromptUrl(prompt.id, prompt.slug)})`,
        "",
        "---",
        "",
      ]),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${list.slug}.md"`,
      },
    });
  }

  return NextResponse.json({
    list: {
      name: list.name,
      slug: list.slug,
      description: list.description,
      exportedAt: new Date().toISOString(),
      prompts: prompts.map((prompt) => ({
        id: prompt.id,
        title: prompt.title,
        slug: prompt.slug,
        description: prompt.description,
        type: prompt.type,
        content: prompt.content,
        url: `${origin}${getPromptUrl(prompt.id, prompt.slug)}`,
      })),
    },
  });
}

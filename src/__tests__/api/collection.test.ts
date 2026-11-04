import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST, DELETE } from "@/app/api/collection/route";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { getOrCreateDefaultCollectionList } from "@/lib/collection-lists";

vi.mock("@/lib/collection-lists", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/collection-lists")>();
  return {
    ...actual,
    getOrCreateDefaultCollectionList: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    collectionList: {
      findFirst: vi.fn(),
    },
    prompt: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

describe("GET /api/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return empty collections array", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.collection.findMany).mockResolvedValue([]);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.collections).toEqual([]);
  });

  it("should fetch collections ordered by createdAt desc", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.collection.findMany).mockResolvedValue([]);

    await GET();

    expect(db.collection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user1" },
        orderBy: { createdAt: "desc" },
      })
    );
  });
});

describe("POST /api/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateDefaultCollectionList).mockResolvedValue({
      id: "list-default",
      userId: "user1",
      name: "Saved",
      slug: "saved",
      isDefault: true,
      isPublic: false,
    } as never);
  });

  it("should return 401 if not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);

    const request = new Request("http://localhost:3000/api/collection", {
      method: "POST",
      body: JSON.stringify({ promptId: "123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("should return 400 if already in collection", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.collection.findUnique).mockResolvedValue({ listId: "list-default", promptId: "123" } as never);

    const request = new Request("http://localhost:3000/api/collection", {
      method: "POST",
      body: JSON.stringify({ promptId: "123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Already in collection");
  });

  it("should add public prompt to default list", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.collection.findUnique).mockResolvedValue(null);
    vi.mocked(db.prompt.findUnique).mockResolvedValue({
      id: "123",
      isPrivate: false,
      authorId: "other-user",
    } as never);
    vi.mocked(db.collection.create).mockResolvedValue({
      listId: "list-default",
      userId: "user1",
      promptId: "123",
    } as never);

    const request = new Request("http://localhost:3000/api/collection", {
      method: "POST",
      body: JSON.stringify({ promptId: "123" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.added).toBe(true);
    expect(db.collection.create).toHaveBeenCalledWith({
      data: {
        listId: "list-default",
        userId: "user1",
        promptId: "123",
      },
    });
  });
});

describe("DELETE /api/collection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should remove prompt from all lists when listId omitted", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "user1" } } as never);
    vi.mocked(db.collection.deleteMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(db.collection.count).mockResolvedValue(0);

    const request = new Request("http://localhost:3000/api/collection?promptId=123", {
      method: "DELETE",
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.removed).toBe(true);
    expect(db.collection.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user1", promptId: "123" },
    });
  });
});

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Download,
  Globe,
  Link2,
  Loader2,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DEFAULT_COLLECTION_LIST_SLUG } from "@/lib/collection-lists.constants";

export interface CollectionListSummary {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isPublic: boolean;
  isDefault: boolean;
  promptCount: number;
}

interface CollectionListsSidebarProps {
  lists: CollectionListSummary[];
  activeListId: string;
  username: string;
}

export function CollectionListsSidebar({
  lists: initialLists,
  activeListId,
  username,
}: CollectionListsSidebarProps) {
  const t = useTranslations("collection");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lists, setLists] = useState(initialLists);
  const [createOpen, setCreateOpen] = useState(false);
  const [editList, setEditList] = useState<CollectionListSummary | null>(null);
  const [deleteList, setDeleteList] = useState<CollectionListSummary | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPublic, setFormPublic] = useState(false);

  useEffect(() => {
    setLists(initialLists);
  }, [initialLists]);

  const refreshLists = useCallback(async () => {
    const res = await fetch("/api/collection/lists");
    if (res.ok) {
      const data = await res.json();
      setLists(data.lists);
    }
  }, []);

  const openCreate = () => {
    setFormName("");
    setFormDescription("");
    setFormPublic(false);
    setCreateOpen(true);
  };

  const openEdit = (list: CollectionListSummary) => {
    setFormName(list.name);
    setFormDescription(list.description ?? "");
    setFormPublic(list.isPublic);
    setEditList(list);
  };

  const navigateToList = (list: CollectionListSummary) => {
    const params = new URLSearchParams(searchParams.toString());
    if (list.isDefault || list.slug === DEFAULT_COLLECTION_LIST_SLUG) {
      params.delete("list");
    } else {
      params.set("list", list.slug);
    }
    const query = params.toString();
    router.push(query ? `/collection?${query}` : "/collection");
  };

  const publicListUrl = (list: CollectionListSummary) =>
    `${window.location.origin}/@${username}/lists/${list.slug}`;

  const copyPublicLink = async (list: CollectionListSummary) => {
    if (!list.isPublic) return;
    try {
      await navigator.clipboard.writeText(publicListUrl(list));
      toast.success(t("linkCopied"));
    } catch {
      toast.error(t("copyLinkFailed"));
    }
  };

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/collection/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
          isPublic: formPublic,
        }),
      });
      if (!res.ok) {
        toast.error(t("createError"));
        return;
      }
      const data = await res.json();
      toast.success(t("createSuccess"));
      setCreateOpen(false);
      await refreshLists();
      router.push(`/collection?list=${data.list.slug}`);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async () => {
    if (!editList || !formName.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/collection/lists/${editList.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || null,
          isPublic: formPublic,
        }),
      });
      if (!res.ok) {
        toast.error(t("updateError"));
        return;
      }
      toast.success(t("updateSuccess"));
      setEditList(null);
      await refreshLists();
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteList) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/collection/lists/${deleteList.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error(t("deleteError"));
        return;
      }
      toast.success(t("deleteSuccess"));
      setDeleteList(null);
      if (deleteList.id === activeListId) {
        router.push("/collection");
      }
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadExport = async (list: CollectionListSummary, format: "json" | "markdown") => {
    const res = await fetch(`/api/collection/lists/${list.id}/export?format=${format}`);
    if (!res.ok) {
      toast.error(t("exportError"));
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${list.slug}.${format === "markdown" ? "md" : "json"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const listFormDialog = (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createList")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="list-name">{t("listName")}</Label>
              <Input
                id="list-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t("listNamePlaceholder")}
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="list-desc">{t("listDescription")}</Label>
              <Textarea
                id="list-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder={t("listDescriptionPlaceholder")}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t("publicList")}</p>
                <p className="text-xs text-muted-foreground">{t("publicListHint")}</p>
              </div>
              <Switch checked={formPublic} onCheckedChange={setFormPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !formName.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editList} onOpenChange={(open) => !open && setEditList(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("editList")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-list-name">{t("listName")}</Label>
              <Input
                id="edit-list-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                maxLength={80}
                disabled={editList?.isDefault}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-list-desc">{t("listDescription")}</Label>
              <Textarea
                id="edit-list-desc"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                maxLength={500}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <div>
                <p className="text-sm font-medium">{t("publicList")}</p>
                <p className="text-xs text-muted-foreground">{t("publicListHint")}</p>
              </div>
              <Switch checked={formPublic} onCheckedChange={setFormPublic} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditList(null)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleUpdate} disabled={isSubmitting || !formName.trim()}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteList} onOpenChange={(open) => !open && setDeleteList(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteList")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteListConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isSubmitting}>
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t("listsTitle")}</h2>
          <Button variant="outline" size="sm" className="h-8 gap-1" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" />
            {t("newList")}
          </Button>
        </div>
        <ul className="space-y-1">
          {lists.map((list) => {
            const isActive = list.id === activeListId;
            return (
              <li key={list.id}>
                <div
                  className={cn(
                    "flex items-center gap-1 rounded-md border px-2 py-1.5",
                    isActive ? "border-primary/40 bg-primary/5" : "border-transparent hover:bg-muted/60"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => navigateToList(list)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
                  >
                    {list.isPublic ? (
                      <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    ) : (
                      <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate font-medium">{list.name}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {list.promptCount}
                    </span>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">{t("listActions")}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(list)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        {t("editList")}
                      </DropdownMenuItem>
                      {list.isPublic && (
                        <DropdownMenuItem onClick={() => copyPublicLink(list)}>
                          <Link2 className="mr-2 h-4 w-4" />
                          {t("copyLink")}
                        </DropdownMenuItem>
                      )}
                      {list.isPublic && (
                        <DropdownMenuItem asChild>
                          <Link href={`/@${username}/lists/${list.slug}`} target="_blank">
                            <Globe className="mr-2 h-4 w-4" />
                            {t("viewPublic")}
                          </Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => downloadExport(list, "json")}>
                        <Download className="mr-2 h-4 w-4" />
                        {t("exportJson")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => downloadExport(list, "markdown")}>
                        <Download className="mr-2 h-4 w-4" />
                        {t("exportMarkdown")}
                      </DropdownMenuItem>
                      {!list.isDefault && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteList(list)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t("deleteList")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {listFormDialog}
    </>
  );
}

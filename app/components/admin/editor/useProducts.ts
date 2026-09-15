"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedFetch, API_ENDPOINTS, UPLOAD_TIMEOUT_MS } from "../../../utils/api";
import { useToast } from "../../ui/Toast";

export interface StoreProduct {
  id: string;
  name: string;
  price: string;
  imageUrl?: string | null;
  category?: string | null;
  description?: string | null;
  link?: string | null;
  sortOrder: number;
  isVisible: boolean;
}

export interface NewProductDraft {
  name: string;
  price: string;
  category: string;
  description: string;
  link: string;
}

export const BLANK_PRODUCT: NewProductDraft = {
  name: "",
  price: "",
  category: "",
  description: "",
  link: "",
};

/**
 * The store catalogue, as the editor needs it. Lifted out of the old
 * single-file editor so the list and the detail pane can share one copy of the
 * data instead of each fetching it.
 */
export function useProducts(onChanged: () => void) {
  const { toast } = useToast();
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    const res = await authenticatedFetch(API_ENDPOINTS.STORE.LIST_ALL);
    if (res.ok) setProducts(await res.json());
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const refresh = useCallback(async () => {
    await fetchProducts();
    onChanged();
  }, [fetchProducts, onChanged]);

  const uploadImage = useCallback(
    async (id: string, file: File) => {
      setBusyId(id);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await authenticatedFetch(API_ENDPOINTS.STORE.UPLOAD_IMAGE(id), {
          method: "POST",
          body: formData,
          timeoutMs: UPLOAD_TIMEOUT_MS,
        });
        if (res.ok) await refresh();
        else toast("The image could not be uploaded", "error");
      } finally {
        setBusyId(null);
      }
    },
    [refresh, toast],
  );

  const create = useCallback(
    async (draft: NewProductDraft, file: File | null): Promise<string | null> => {
      if (!draft.name || !draft.price) return null;
      setSaving(true);
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.STORE.CREATE, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast(err.message || "Failed to create product", "error");
          return null;
        }
        const created = await res.json();
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          const imgRes = await authenticatedFetch(API_ENDPOINTS.STORE.UPLOAD_IMAGE(created.id), {
            method: "POST",
            body: formData,
            timeoutMs: UPLOAD_TIMEOUT_MS,
          });
          if (!imgRes.ok) toast("Product created, but the image upload failed", "error");
        }
        await refresh();
        return created.id as string;
      } catch (err) {
        console.error("Failed to create product:", err);
        toast("Could not reach the server", "error");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [refresh, toast],
  );

  const update = useCallback(
    async (id: string, patch: Partial<StoreProduct>) => {
      setSaving(true);
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.STORE.UPDATE(id), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) await refresh();
        else toast("Failed to save the product", "error");
        return res.ok;
      } finally {
        setSaving(false);
      }
    },
    [refresh, toast],
  );

  const remove = useCallback(
    async (id: string) => {
      if (busyId) return false;
      setBusyId(id);
      try {
        const res = await authenticatedFetch(API_ENDPOINTS.STORE.DELETE(id), { method: "DELETE" });
        if (res.ok) {
          toast("Product deleted", "success");
          await refresh();
        } else {
          toast("Failed to delete product", "error");
        }
        return res.ok;
      } finally {
        setBusyId(null);
      }
    },
    [busyId, refresh, toast],
  );

  const removeImage = useCallback(
    async (id: string) => {
      const res = await authenticatedFetch(API_ENDPOINTS.STORE.DELETE_IMAGE(id), { method: "DELETE" });
      if (res.ok) await refresh();
    },
    [refresh],
  );

  return { products, busyId, saving, create, update, remove, uploadImage, removeImage, refresh };
}

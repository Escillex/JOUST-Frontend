"use client";
import { useState } from 'react';
import { authenticatedFetch, safeJson, UPLOAD_TIMEOUT_MS } from './api';

export function useImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (endpoint: string, file: File): Promise<string | null> => {
    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await authenticatedFetch(endpoint, {
        method: 'POST',
        body: formData,
        // An image is real bytes over the same slow link, so the default
        // request timeout is far too short for it.
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });

      const data = await safeJson(res);

      if (!res.ok) {
        throw new Error(data?.message || 'Upload failed');
      }

      return data.bannerUrl || data.avatarUrl || data.url || null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during upload';
      setError(msg);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const remove = async (endpoint: string): Promise<boolean> => {
    setUploading(true);
    setError(null);

    try {
      const res = await authenticatedFetch(endpoint, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await safeJson(res);
        throw new Error(data?.message || 'Delete failed');
      }

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error during delete';
      setError(msg);
      return false;
    } finally {
      setUploading(false);
    }
  };

  return { upload, remove, uploading, error };
}

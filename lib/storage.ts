import { createAdminSupabaseClient } from "./supabase/admin";

const bucketName = "media";

export function mediaBucket() {
  const storage = createAdminSupabaseClient().storage.from(bucketName);
  return {
    async put(key: string, body: Blob, contentType?: string) {
      const { error } = await storage.upload(key, body, { contentType: contentType || body.type, upsert: true });
      if (error) throw error;
    },
    async delete(key: string) {
      const { error } = await storage.remove([key]);
      if (error) throw error;
    },
    async createSignedUpload(key: string) {
      const { data, error } = await storage.createSignedUploadUrl(key);
      if (error) throw error;
      return data;
    },
    async exists(key: string) {
      const { data, error } = await storage.exists(key);
      if (error) throw error;
      return data;
    },
    publicUrl(key: string) {
      return storage.getPublicUrl(key).data.publicUrl;
    },
  };
}

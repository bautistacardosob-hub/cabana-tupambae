"use client";

import { createBrowserSupabaseClient } from "./supabase/client";

const allowedImages = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]);
const maxImageBytes = 12 * 1024 * 1024;
const allowedDocuments = new Set(["application/pdf"]);
const maxDocumentBytes = 24 * 1024 * 1024;

type ApiError = { error?: string };
type PreparedUpload = ApiError & { upload?: { path: string; token: string } };

async function optimizedUpload(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 500 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "imagen";
    return new File([blob], `${name}.webp`, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

export async function readApiJson<T extends ApiError>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text) {
    if (response.status === 413) throw new Error("La imagen es demasiado grande para procesarla.");
    throw new Error(`El servidor no devolvió una respuesta válida (${response.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`El servidor devolvió una respuesta inválida (${response.status}).`);
  }
}

export async function uploadImageDirect<T extends ApiError>(endpoint: string, file: File, metadata: Record<string, unknown>): Promise<T> {
  if (!allowedImages.has(file.type)) throw new Error("Usá una imagen JPG, PNG, WebP, GIF o SVG.");
  if (file.size > maxImageBytes) throw new Error("La imagen no puede superar los 12 MB.");
  const uploadFile = await optimizedUpload(file);

  const prepareResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare-image", ...metadata, filename: uploadFile.name, contentType: uploadFile.type, size: uploadFile.size }),
  });
  const prepared = await readApiJson<PreparedUpload>(prepareResponse);
  if (!prepareResponse.ok || !prepared.upload) throw new Error(prepared.error || "No se pudo preparar la fotografía.");

  const { error: uploadError } = await createBrowserSupabaseClient().storage
    .from("media")
    .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, uploadFile, { contentType: uploadFile.type });
  if (uploadError) throw new Error(uploadError.message || "No se pudo subir la fotografía.");

  const completeResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete-image", ...metadata, storageKey: prepared.upload.path, filename: uploadFile.name, contentType: uploadFile.type, size: uploadFile.size }),
  });
  const completed = await readApiJson<T>(completeResponse);
  if (!completeResponse.ok) throw new Error(completed.error || "No se pudo registrar la fotografía.");
  return completed;
}

export async function uploadFileDirect<T extends ApiError>(endpoint: string, file: File, metadata: Record<string, unknown>): Promise<T> {
  if (!allowedDocuments.has(file.type)) throw new Error("El documento debe ser un archivo PDF.");
  if (file.size > maxDocumentBytes) throw new Error("El PDF no puede superar los 24 MB.");

  const prepareResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "prepare-image", ...metadata, filename: file.name, contentType: file.type, size: file.size }),
  });
  const prepared = await readApiJson<PreparedUpload>(prepareResponse);
  if (!prepareResponse.ok || !prepared.upload) throw new Error(prepared.error || "No se pudo preparar el PDF.");

  const { error: uploadError } = await createBrowserSupabaseClient().storage
    .from("media")
    .uploadToSignedUrl(prepared.upload.path, prepared.upload.token, file, { contentType: file.type });
  if (uploadError) throw new Error(uploadError.message || "No se pudo subir el PDF.");

  const completeResponse = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "complete-image", ...metadata, storageKey: prepared.upload.path, filename: file.name, contentType: file.type, size: file.size }),
  });
  const completed = await readApiJson<T>(completeResponse);
  if (!completeResponse.ok) throw new Error(completed.error || "No se pudo registrar el PDF.");
  return completed;
}

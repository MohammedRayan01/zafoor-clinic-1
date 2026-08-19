"use server"

import { writeFile, mkdir } from "fs/promises"
import path from "path"
import { nanoid } from "nanoid"
import { supabase, STORAGE_BUCKET } from "@/lib/supabase"

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")
const MAX_SIZE_BYTES = 10 * 1024 * 1024

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File | null
  if (!file || file.size === 0) {
    throw new Error("No file provided")
  }
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File exceeds 10MB limit")
  }

  const ext = path.extname(file.name) || ""
  const safeName = `${nanoid(12)}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  // 1. Try uploading to Supabase Storage if configured
  if (supabase) {
    try {
      // Ensure bucket exists or upload directly
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(safeName, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: true,
        })

      if (!error && data) {
        const { data: publicUrlData } = supabase.storage
          .from(STORAGE_BUCKET)
          .getPublicUrl(data.path)

        return {
          url: publicUrlData.publicUrl,
          name: file.name,
          type: file.type,
        }
      }
    } catch (err) {
      console.warn("[upload] Supabase upload failed, falling back to local storage:", err)
    }
  }

  // 2. Local disk fallback
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(UPLOAD_DIR, safeName), buffer)

  return {
    url: `/uploads/${safeName}`,
    name: file.name,
    type: file.type,
  }
}

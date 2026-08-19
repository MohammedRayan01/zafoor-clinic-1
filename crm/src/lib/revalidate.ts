import { revalidatePath } from "next/cache"

export function safeRevalidatePath(originalPath: string, type?: "layout" | "page") {
  try {
    revalidatePath(originalPath, type)
  } catch {
    // In standalone CLI execution or test suites, static generation store is not active
  }
}

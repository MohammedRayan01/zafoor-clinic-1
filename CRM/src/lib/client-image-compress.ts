"use client"

// Compresses an image File in the browser, before it ever crosses the
// Server Action boundary — Next's default Server Action body limit is 1MB,
// and a real phone photo is routinely several MB, so compression has to
// happen client-side rather than after the (already-too-large) upload
// reaches the server. Non-image files (PDFs, etc.) pass through untouched.
const TARGET_MAX_BYTES = 300 * 1024

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error("Could not read image"))
    }
    img.src = url
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality))
}

/** Re-encodes an image File down into the 100-300KB band via canvas re-compression + downscaling. */
export async function compressImageClientSide(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return file
  }
  if (file.size <= TARGET_MAX_BYTES) {
    return file
  }

  const img = await loadImage(file)
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")
  if (!ctx) return file

  let width = img.naturalWidth
  let height = img.naturalHeight

  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    for (const quality of [0.8, 0.65, 0.5, 0.35, 0.25]) {
      const blob = await canvasToBlob(canvas, quality)
      if (blob && blob.size <= TARGET_MAX_BYTES) {
        const ext = file.name.replace(/\.[^.]+$/, "") + ".jpg"
        return new File([blob], ext, { type: "image/jpeg" })
      }
    }
    width = Math.round(width * 0.75)
    height = Math.round(height * 0.75)
    if (width < 200 || height < 200) break
  }

  // Last resort: smallest/lowest-quality pass, whatever size it lands at.
  canvas.width = 200
  canvas.height = Math.round((200 / img.naturalWidth) * img.naturalHeight)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const fallback = await canvasToBlob(canvas, 0.2)
  if (!fallback) return file
  const ext = file.name.replace(/\.[^.]+$/, "") + ".jpg"
  return new File([fallback], ext, { type: "image/jpeg" })
}

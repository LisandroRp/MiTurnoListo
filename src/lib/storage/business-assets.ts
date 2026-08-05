"use client";

import { getAccessToken } from "@/lib/networking/endpoints/auth";

const maxImageDimension = 1400;
const webpQualities = [0.82, 0.74, 0.66];

export async function uploadBusinessImageAsset({
  businessId,
  file,
  path
}: {
  businessId: string;
  file: File;
  path: string;
}) {
  const imageBlob = await compressImageToWebp(file);
  const token = await getAccessToken();
  const formData = new FormData();

  formData.set("businessId", businessId);
  formData.set("path", path);
  formData.set("file", imageBlob, "image.webp");

  const response = await fetch("/api/assets/upload", {
    method: "POST",
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData
  });
  const payload = await response.json().catch(() => null) as { error?: string; publicUrl?: string } | null;

  if (!response.ok || !payload?.publicUrl) {
    throw new Error(payload?.error ?? "No pudimos subir la imagen. Revisa la configuracion de Storage.");
  }

  return payload.publicUrl;
}

async function compressImageToWebp(file: File) {
  const image = await loadImage(file);
  const { height, width } = getResizedDimensions(image.width, image.height);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("No pudimos procesar la imagen en este navegador.");
  }

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);

  for (const quality of webpQualities) {
    const blob = await canvasToBlob(canvas, "image/webp", quality);

    if (blob.size <= 1024 * 1024 || quality === webpQualities[webpQualities.length - 1]) {
      return blob;
    }
  }

  throw new Error("La imagen es demasiado grande. Proba con otra imagen.");
}

function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No pudimos procesar esta imagen. Si es HEIC/HEIF, proba exportarla como JPG o PNG."));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No pudimos comprimir la imagen."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function getResizedDimensions(width: number, height: number) {
  const largestSide = Math.max(width, height);

  if (largestSide <= maxImageDimension) {
    return { height, width };
  }

  const scale = maxImageDimension / largestSide;

  return {
    height: Math.round(height * scale),
    width: Math.round(width * scale)
  };
}

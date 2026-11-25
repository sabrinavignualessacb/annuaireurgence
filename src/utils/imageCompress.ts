export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxChars?: number;
}

/**
 * Compresse et redimensionne un logo ou pictogramme pour rester sous la limite Firestore.
 */
export async function compressLogoFileToDataUrl(
  file: File,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxW = options.maxWidth ?? 600;
  const maxH = options.maxHeight ?? 240;
  const maxChars = options.maxChars ?? 350000;

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Impossible de lire le fichier image.'));
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
    reader.readAsDataURL(file);
  });

  // Si c'est un SVG léger, le garder tel quel s'il respecte le budget
  if (file.type === 'image/svg+xml' && rawDataUrl.length <= Math.round(maxChars * 0.85)) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl.slice(0, maxChars));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      let out = canvas.toDataURL('image/png');
      if (out.length > maxChars) {
        out = canvas.toDataURL('image/webp', 0.85);
      }
      if (out.length > maxChars) {
        out = canvas.toDataURL('image/jpeg', 0.82);
      }
      resolve(out.slice(0, maxChars));
    };
    img.onerror = () => resolve(rawDataUrl.slice(0, maxChars));
    img.src = rawDataUrl;
  });
}

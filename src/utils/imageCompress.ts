/**
 * Compresse et redimensionne un logo image pour rester largement sous la limite Firestore (< 350 Ko).
 */
export async function compressLogoFileToDataUrl(file: File): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Impossible de lire le fichier image.'));
    };
    reader.onerror = () => reject(new Error('Erreur de lecture du fichier image.'));
    reader.readAsDataURL(file);
  });

  // Si c'est un SVG léger, le garder tel quel s'il fait < 300 Ko
  if (file.type === 'image/svg+xml' && rawDataUrl.length < 300000) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 600;
      const maxH = 240;
      const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
      const targetW = Math.max(1, Math.round(img.width * ratio));
      const targetH = Math.max(1, Math.round(img.height * ratio));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(rawDataUrl.slice(0, 390000));
        return;
      }
      ctx.drawImage(img, 0, 0, targetW, targetH);

      let out = canvas.toDataURL('image/png');
      if (out.length > 350000) {
        out = canvas.toDataURL('image/webp', 0.85);
      }
      if (out.length > 350000) {
        out = canvas.toDataURL('image/jpeg', 0.82);
      }
      resolve(out);
    };
    img.onerror = () => resolve(rawDataUrl.slice(0, 390000));
    img.src = rawDataUrl;
  });
}

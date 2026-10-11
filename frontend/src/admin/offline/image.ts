/**
 * Réduit une photo du téléphone (souvent 4 à 8 Mo) avant de la stocker et de l'envoyer : 1 920 px
 * maximum, JPEG. Moins de données mobiles et un envoi qui passe mieux sur un réseau faible. Le serveur
 * la convertit ensuite en WebP. En cas d'échec, la photo d'origine est gardée.
 */
export async function shrinkImage(file: File, max = 1920, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) { bitmap.close(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

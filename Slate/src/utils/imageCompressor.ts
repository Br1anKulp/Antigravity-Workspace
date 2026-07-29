/**
 * Resizes and compresses an image file to WebP format, capping the output under maxWeightBytes.
 */
export const compressImage = (file: File, maxWidth = 1200, maxWeightBytes = 1.5 * 1024 * 1024): Promise<File> => {
  return new Promise((resolve) => {
    // If not an image, return original file
    if (!file.type.startsWith('image/')) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Scale maintaining aspect ratio
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.8;
        const getBlob = (q: number): Promise<Blob | null> => {
          return new Promise(res => canvas.toBlob(res, 'image/webp', q));
        };

        const iterate = async () => {
          let blob = await getBlob(quality);
          while (blob && blob.size > maxWeightBytes && quality > 0.3) {
            quality -= 0.1;
            blob = await getBlob(quality);
          }
          if (blob) {
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file);
          }
        };
        iterate();
      };
      img.onerror = () => resolve(file);
      img.src = e.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

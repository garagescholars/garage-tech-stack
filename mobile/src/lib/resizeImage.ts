import { Platform } from "react-native";

/**
 * Cross-platform image resize.
 * Web: uses Canvas API.
 * Native: uses expo-image-manipulator.
 */
export async function resizeImage(
  uri: string,
  maxDim = 1600,
  quality = 0.8
): Promise<string> {
  if (Platform.OS === "web") {
    return resizeImageWeb(uri, maxDim, quality);
  }
  return resizeImageNative(uri, maxDim, quality);
}

// Web: Canvas-based resize (works with base64 data URLs)
function resizeImageWeb(
  dataUrl: string,
  maxDim: number,
  quality: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width,
        h = img.height;
      if (w <= maxDim && h <= maxDim) {
        resolve(dataUrl);
        return;
      }
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

// Native: expo-image-manipulator resize
async function resizeImageNative(
  uri: string,
  maxDim: number,
  quality: number
): Promise<string> {
  const ImageManipulator = require("expo-image-manipulator");
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxDim } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

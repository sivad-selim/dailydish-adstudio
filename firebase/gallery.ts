import {
  deleteObject,
  getBlob,
  getDownloadURL,
  getMetadata,
  getStorage,
  listAll,
  ref,
  uploadBytes,
  updateMetadata,
} from "firebase/storage";
import { firebaseApp } from "./firebaseAuth";

const GALLERY_BUCKET_URL = "gs://daily-dish-b10b4-ad-studio";
const GALLERY_FOLDER = "gallery";
const LEGACY_MASCOT_FOLDER = "mascots";
const MAX_GALLERY_FILE_BYTES = 15 * 1024 * 1024;
const GALLERY_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export type GalleryAsset = {
  id: string;
  path: string;
  name: string;
  url: string;
  size: number;
  createdAt: string;
  folderId?: string;
};

const galleryStorage = getStorage(firebaseApp, GALLERY_BUCKET_URL);

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });

export async function getGalleryAssetDataUrl(
  asset: GalleryAsset,
): Promise<string> {
  const blob = await getBlob(
    ref(galleryStorage, asset.path),
    MAX_GALLERY_FILE_BYTES,
  );
  return blobToDataUrl(blob);
}

const normalizeFileName = (fileName: string) => {
  const withoutExtension = fileName.replace(/\.(png|jpe?g|webp)$/i, "");
  const normalized = withoutExtension
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return normalized || "image";
};

const validateGalleryFile = (file: File) => {
  if (!GALLERY_IMAGE_TYPES.includes(file.type)) {
    throw new Error("La galerie accepte les images PNG, JPG et WebP.");
  }
  if (file.size > MAX_GALLERY_FILE_BYTES) {
    throw new Error("Chaque image doit peser moins de 15 Mo.");
  }
};

const fileExtension = (file: File) => {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/webp") return "webp";
  return "png";
};

export async function listGalleryAssets(): Promise<GalleryAsset[]> {
  const listings = await Promise.all([
    listAll(ref(galleryStorage, GALLERY_FOLDER)),
    listAll(ref(galleryStorage, LEGACY_MASCOT_FOLDER)),
  ]);
  const assets = await Promise.all(
    listings.flatMap((listing) => listing.items).map(async (item) => {
      const [metadata, url] = await Promise.all([
        getMetadata(item),
        getDownloadURL(item),
      ]);

      return {
        id: item.fullPath,
        path: item.fullPath,
        name: metadata.customMetadata?.originalName ?? item.name,
        url,
        size: metadata.size,
        createdAt: metadata.timeCreated,
        folderId: metadata.customMetadata?.folderId ?? "",
      } satisfies GalleryAsset;
    }),
  );

  return assets.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function uploadGalleryFiles(files: File[], folderId = ""): Promise<GalleryAsset[]> {
  files.forEach(validateGalleryFile);

  return Promise.all(
    files.map(async (file) => {
      const fileName = `${Date.now()}-${crypto.randomUUID()}-${normalizeFileName(file.name)}.${fileExtension(file)}`;
      const fileRef = ref(galleryStorage, `${GALLERY_FOLDER}/${fileName}`);

      const result = await uploadBytes(fileRef, file, {
        cacheControl: "public,max-age=31536000,immutable",
        contentType: file.type,
        customMetadata: {
          originalName: file.name,
          folderId,
        },
      });
      return {
        id: fileRef.fullPath,
        path: fileRef.fullPath,
        name: file.name,
        url: await getDownloadURL(fileRef),
        size: result.metadata.size,
        createdAt: result.metadata.timeCreated,
        folderId,
      };
    }),
  );
}

export async function moveGalleryAsset(asset: GalleryAsset, folderId: string): Promise<void> {
  // Keep the object path and download URL stable for existing creations.
  await updateMetadata(ref(galleryStorage, asset.path), {
    customMetadata: { folderId },
  });
}

export async function deleteGalleryAsset(path: string): Promise<void> {
  if (
    !path.startsWith(`${GALLERY_FOLDER}/`) &&
    !path.startsWith(`${LEGACY_MASCOT_FOLDER}/`)
  ) {
    throw new Error("Cette image ne peut pas être supprimée.");
  }

  try {
    await deleteObject(ref(galleryStorage, path));
  } catch (error: unknown) {
    if ((error as { code?: string })?.code === "storage/object-not-found") {
      return;
    }
    throw error;
  }
}

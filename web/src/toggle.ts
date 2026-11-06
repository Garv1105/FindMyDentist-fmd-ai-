// Site-wide switches: change a value here and redeploy.

/**
 * Where the home page's 3D models load from:
 *   true  → Cloudinary (the URLs in src/lib/models.ts; upload or re-upload with `node scripts/upload-models.mjs`)
 *   false → the site's own copies in web/public
 */
export const USE_CLOUDINARY_MODELS = false;

/** Only used when USE_CLOUDINARY_MODELS is false: bump it after rebuilding a model in web/public, or browsers keep the old one. */
export const LOCAL_MODELS_VERSION = 6;

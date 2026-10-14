import type { GenerateURL } from '@payloadcms/plugin-cloud-storage/types'
import type { CloudinaryStorageOptions } from '../types.js'
import { buildDeliveryURL, deliveryAssetOf, isPrivateFile } from '../helpers/deliveryURL.js'
import { normalizeCollectionConfig, getTransformationConfig } from '../helpers/normalizeConfig.js'

export const createURLGenerator =
  (options: CloudinaryStorageOptions): GenerateURL =>
  ({ collection, filename, prefix, data }) => {
    const collectionConfig = options.collections[collection.slug]

    if (!collectionConfig) {
      return filename
    }

    const rawConfig = typeof collectionConfig === 'boolean' ? {} : collectionConfig
    const config = normalizeCollectionConfig(rawConfig)
    const transformConfig = getTransformationConfig(config)

    // A private file gets its URLs from the afterRead hook, after the access check. This
    // handler has no request, so it hands out nothing for one. Payload v4 also stores what this
    // returns, through the url fields' beforeChange hooks, so it returns null, which a private
    // file stores in every URL field, rather than an empty string. The type allows only a string.
    if (config.privateFiles && isPrivateFile(data ?? {})) {
      return null as unknown as string
    }

    try {
      const transformations: Record<string, any> = {
        ...(transformConfig.default || {}),
      }

      if (transformations.format === 'auto' || transformations.fetchFormat === 'auto') {
        transformations.fetch_format = 'auto'
        delete transformations.format
      }

      if (transformations.quality === 'auto') {
        transformations.quality = 'auto'
      }

      // Use the stored asset. Without a stored public_id, derive it from the prefix and filename.
      const stored = deliveryAssetOf(data ?? {})
      const stem = filename.substring(0, filename.lastIndexOf('.'))
      const asset = data?.cloudinaryPublicId
        ? stored
        : { ...stored, publicId: prefix ? `${prefix}/${stem}` : stem }

      // A variant is delivered from the main asset, resized first, then the collection defaults
      const resize = variantResize(data, filename)
      const chain = [
        ...(resize ? [resize] : []),
        ...(Object.keys(transformations).length > 0 ? [transformations] : []),
      ]

      return buildDeliveryURL(asset, {
        transformation: chain.length > 0 ? chain : undefined,
      })
    } catch (error) {
      console.error('[Cloudinary URL] Error generating URL:', error)
      return filename
    }
  }

/**
 * The resize for an image variant: the size the transformer produced, stored on the document's
 * `variants` entry with the variant's filename. Only the main file is uploaded (see handleUpload),
 * so Cloudinary crops the main asset to that size, centred, as sharp's default `cover` does.
 * shortcut: ignores a moved focal point and sharp's `contain`/`fill` fits; compute the crop from
 * focalX/focalY when someone needs them.
 */
function variantResize(data: unknown, filename: string): Record<string, unknown> | undefined {
  const variants = (data as { variants?: unknown } | undefined)?.variants
  if (!variants || typeof variants !== 'object') return undefined
  for (const variant of Object.values(variants as Record<string, Record<string, unknown>>)) {
    if (variant?.filename !== filename) continue
    const { width, height } = variant
    if (typeof width !== 'number' || typeof height !== 'number') return undefined
    return { width, height, crop: 'fill' }
  }
  return undefined
}

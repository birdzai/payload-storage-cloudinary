import type { TransformationPreset } from '../types.js'

export interface TransformOptions {
  publicId: string
  version?: number
  presetName?: string
  presets?: TransformationPreset[]
  customTransformations?: Record<string, any>
  cloudName?: string
}

/**
 * Client-safe URL builder for Cloudinary transformations
 * This doesn't use the Cloudinary SDK so it can be used in browser environments
 */
export function getTransformationUrl(options: TransformOptions): string {
  const { publicId, version, presetName, presets, customTransformations, cloudName } = options
  
  // Try to get cloud name from the URL if not provided
  let finalCloudName = cloudName
  
  // If publicId contains the full URL, extract cloud name and public ID from it
  if (!finalCloudName && publicId.includes('res.cloudinary.com')) {
    const urlMatch = publicId.match(/res\.cloudinary\.com\/([^\/]+)\/[^\/]+\/upload\/(?:v\d+\/)?(.+)/)
    if (urlMatch) {
      finalCloudName = urlMatch[1]
      // Update publicId to just be the public ID part
      const publicIdMatch = urlMatch[2]
      if (publicIdMatch) {
        return getTransformationUrl({
          ...options,
          publicId: publicIdMatch,
          cloudName: finalCloudName
        })
      }
    }
  }
  
  // Try to extract from existing Cloudinary URLs on the page
  if (!finalCloudName && typeof window !== 'undefined') {
    const existingCloudinaryUrl = document.querySelector('img[src*="res.cloudinary.com"]')?.getAttribute('src')
    if (existingCloudinaryUrl) {
      const match = existingCloudinaryUrl.match(/res\.cloudinary\.com\/([^\/]+)/)
      if (match) finalCloudName = match[1]
    }
  }
  
  if (!finalCloudName) {
    // If we still don't have a cloud name, check if publicId already contains a full URL
    if (publicId.startsWith('http')) {
      console.warn('Could not extract cloud name from URL. Returning original URL.')
      return publicId
    }
    console.warn('Cloud name not provided and could not be detected. URL may not work correctly.')
    finalCloudName = 'your-cloud-name'
  }
  
  let transformations: Record<string, any> = {}
  
  // Apply preset transformations if specified
  if (presetName && presets) {
    const preset = presets.find(p => p.name === presetName)
    if (preset) {
      transformations = { ...preset.transformations }
    }
  }
  
  // Merge with custom transformations
  if (customTransformations) {
    transformations = { ...transformations, ...customTransformations }
  }
  
  // Build transformation string
  const transformString = Object.entries(transformations)
    .map(([key, value]) => {
      // Handle special cases
      if (key === 'fetch_format') return `f_${value}`
      if (key === 'quality') return `q_${value}`
      if (key === 'width') return `w_${value}`
      if (key === 'height') return `h_${value}`
      if (key === 'crop') return `c_${value}`
      if (key === 'gravity') return `g_${value}`
      if (key === 'radius') return `r_${value}`
      if (key === 'effect') return `e_${value}`
      if (key === 'opacity') return `o_${value}`
      if (key === 'overlay') return `l_${value}`
      if (key === 'background') return `b_${value}`
      if (key === 'border') return `bo_${value}`
      if (key === 'angle') return `a_${value}`
      if (key === 'dpr') return `dpr_${value}`
      // Default case
      return `${key}_${value}`
    })
    .join(',')
  
  // Build the URL
  const versionPart = version ? `v${version}/` : ''
  const transformPart = transformString ? `${transformString}/` : ''
  
  return `https://res.cloudinary.com/${finalCloudName}/image/upload/${transformPart}${versionPart}${publicId}`
}

// Re-export common presets (these don't have any server dependencies)
export const commonPresets: TransformationPreset[] = [
  {
    name: 'thumbnail',
    label: 'Thumbnail',
    description: 'Small thumbnail for lists and grids',
    transformations: {
      width: 150,
      height: 150,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    },
  },
  {
    name: 'card',
    label: 'Card Image',
    description: 'Medium size for cards and previews',
    transformations: {
      width: 400,
      height: 300,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto:good',
      fetch_format: 'auto',
    },
  },
  {
    name: 'hero',
    label: 'Hero Image',
    description: 'Large hero/banner image',
    transformations: {
      width: 1920,
      height: 600,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto:good',
      fetch_format: 'auto',
    },
  },
  {
    name: 'banner',
    label: 'Banner',
    description: 'Wide banner image',
    transformations: {
      width: 1200,
      height: 400,
      crop: 'fill',
      gravity: 'center',
      quality: 'auto:good',
      fetch_format: 'auto',
    },
  },
  {
    name: 'square',
    label: 'Square',
    description: 'Square aspect ratio',
    transformations: {
      width: 600,
      height: 600,
      crop: 'fill',
      gravity: 'auto',
      quality: 'auto',
      fetch_format: 'auto',
    },
  },
  {
    name: 'og-image',
    label: 'Open Graph Image',
    description: 'Social media sharing (1200x630)',
    transformations: {
      width: 1200,
      height: 630,
      crop: 'fill',
      gravity: 'center',
      quality: 'auto:good',
      fetch_format: 'jpg',
    },
  },
  {
    name: 'avatar',
    label: 'Avatar',
    description: 'Circular profile image',
    transformations: {
      width: 200,
      height: 200,
      crop: 'thumb',
      gravity: 'face',
      radius: 'max',
      quality: 'auto',
      fetch_format: 'auto',
    },
  },
  {
    name: 'blur',
    label: 'Blurred Placeholder',
    description: 'Low quality blurred preview',
    transformations: {
      width: 50,
      effect: 'blur:1000',
      quality: 'auto:low',
      fetch_format: 'auto',
    },
  },
]
# Private Images Authorization Guide

A comprehensive guide for implementing and using private images with authentication in Payload CMS with Cloudinary storage.

## Overview

This guide covers everything you need to know about working with private images, including:
- Per-file privacy control
- Authentication and authorization
- Public previews with watermarks/blur
- Frontend implementation patterns
- Common troubleshooting

## Key Concepts

### Per-File Privacy Control

Unlike collection-level privacy settings, the plugin supports per-file privacy control:

1. **Collection Configuration**: When you set `privateFiles: true` on a collection, it enables the privacy feature but doesn't force all files to be private
2. **User Control**: Each upload shows a "Private File" checkbox that users can check/uncheck
3. **Default Behavior**: The checkbox defaults to checked (private) but users can uncheck it to make files public

### How Authentication Works

```
User → Frontend → Payload API → Access Control → Cloudinary Signed URL → Image
```

1. **User Authentication**: User must be logged into Payload (via cookie or JWT)
2. **API Request**: Frontend requests signed URL from Payload API
3. **Access Control**: Payload checks user permissions for the document
4. **URL Generation**: If authorized, Payload generates a time-limited Cloudinary URL
5. **Image Delivery**: Frontend uses the signed URL to display the image

### Public Previews

For private files, you can generate public previews with watermarks or blur effects:
- **Watermarked Preview**: Shows a watermarked version publicly
- **Blurred Preview**: Shows a blurred version publicly
- **Combined Preview**: Applies both transformation presets AND watermark/blur

## Configuration

### Basic Setup

```typescript
// In your Payload config
cloudinaryStorage({
  cloudConfig: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  collections: {
    media: {
      privateFiles: true, // Enable private files with default settings
    },
  },
})
```

### With Public Previews

```typescript
collections: {
  media: {
    privateFiles: true,
    transformations: {
      preserveOriginal: true,
      publicTransformation: {
        enabled: true,
        watermark: {
          defaultText: 'PREVIEW',
          style: {
            fontFamily: 'Arial',
            fontSize: 50,
            color: 'rgb:808080',
            opacity: 50,
            angle: -45,
          },
        },
        blur: {
          effect: 'blur:2000',
          quality: 30,
        },
      },
    },
  },
}
```

### With Custom Authentication

```typescript
collections: {
  documents: {
    privateFiles: {
      enabled: true,
      expiresIn: 7200, // 2 hours
      customAuthCheck: async (req, doc) => {
        // Only allow access to the owner
        if (doc.owner !== req.user?.id) {
          return false
        }
        return true
      },
    },
  },
}
```

### Advanced Configuration

```typescript
collections: {
  media: {
    privateFiles: {
      enabled: true,
      expiresIn: 7200, // 2 hours
      customAuthCheck: async (req, doc) => {
        // Allow access to owner or users with specific roles
        if (doc.owner === req.user?.id) {
          return true
        }
        
        if (req.user?.roles?.includes('admin')) {
          return true
        }
        
        return false
      },
    },
  },
}
```

## Required Collection Configuration

For private files to work properly, you must configure access control on your collection:

```typescript
{
  slug: 'media',
  access: {
    read: () => true, // Allow read attempts, we'll check in afterRead
  },
  hooks: {
    afterRead: [
      ({ doc, req }) => {
        // Check if this specific file requires authentication
        if ((doc.requiresSignedURL || doc.isPrivate) && !req.user) {
          return null // Return null for unauthorized access
        }
        return doc
      },
    ],
  },
  upload: {
    disableLocalStorage: true,
  },
  // ... rest of config
}
```

This ensures that:
- Public files are accessible to everyone
- Private files return null for unauthenticated users
- The error is properly handled by the signed URL endpoint

## Frontend Implementation

### Important: Client-Side Imports

Always import from `'payload-storage-cloudinary/client'` for client-side usage:

```typescript
// ✅ Correct - client-side import
import { fetchSignedURL, useSignedURL } from 'payload-storage-cloudinary/client'

// ❌ Wrong - includes server dependencies
import { fetchSignedURL } from 'payload-storage-cloudinary'
```

### 1. Simple Image Display

```tsx
import { getImageURL } from 'payload-storage-cloudinary/client'

function SmartImage({ doc, collection = 'media' }) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // This helper handles both public and private files
    getImageURL(doc, collection)
      .then(setUrl)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [doc, collection])

  if (loading) return <div>Loading...</div>
  if (!url) return <div>Image not available</div>

  return <img src={url} alt={doc.alt} />
}
```

### 2. React Component with Loading State

```tsx
import React, { useState, useEffect } from 'react'
import { fetchSignedURL, requiresSignedURL } from 'payload-storage-cloudinary/client'

function PrivateImageComponent({ doc, collection = 'media' }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadImage() {
      // Check if this image needs a signed URL
      if (!requiresSignedURL(doc)) {
        // Use the best available URL for public files
        setImageUrl(doc.transformedUrl || doc.url)
        return
      }

      setLoading(true)
      try {
        const url = await fetchSignedURL(collection, doc.id)
        setImageUrl(url)
      } catch (err) {
        setError(err as Error)
      } finally {
        setLoading(false)
      }
    }

    loadImage()
  }, [doc, collection])

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!imageUrl) return null

  return <img src={imageUrl} alt={doc.alt} />
}
```

### 3. Using the Built-in Hook

```tsx
import React from 'react'
import { useSignedURL } from 'payload-storage-cloudinary/client'

function PrivateImageWithHook({ doc }) {
  const { url, loading, error } = useSignedURL('media', doc?.id, {
    react: React, // Required for Next.js
    refetchBuffer: 300, // Refetch 5 minutes before expiry
  })

  if (loading) return <div className="skeleton-loader" />
  if (error) return <div className="error">Failed to load image</div>
  if (!url) return null

  return (
    <img 
      src={url} 
      alt={doc.alt}
      className="w-full h-auto"
      loading="lazy"
    />
  )
}
```

### 4. Using the Pre-built Component

```tsx
import React from 'react'
import { createPrivateImageComponent } from 'payload-storage-cloudinary/client'

// Create the component once
const PrivateImage = createPrivateImageComponent(React)

function MyComponent({ doc }) {
  return (
    <PrivateImage 
      doc={doc} 
      collection="media" 
      alt="My private image"
      className="w-full h-auto"
      fallback={<div>Loading...</div>}
    />
  )
}
```

## Working with Public Previews

### Basic Public Preview

```tsx
function ImageWithPreview({ doc }) {
  if (!doc.isPrivate) {
    // Public file - use the best available URL
    const imageUrl = doc.transformedUrl || doc.url
    return <img src={imageUrl} alt={doc.alt} />
  }

  // Private file - show public preview if available
  if (doc.publicTransformationUrl) {
    return (
      <div>
        <img src={doc.publicTransformationUrl} alt={`${doc.alt} - Preview`} />
        <p>This is a preview. <a href="/login">Login</a> to see full quality.</p>
      </div>
    )
  }

  // No public preview - require authentication
  return <div>This image requires authentication</div>
}
```

### Combined Presets and Public Previews

```tsx
function AdvancedImageDisplay({ doc }) {
  if (!doc.isPrivate) {
    // Public file - use transformed URL if available
    return <img src={doc.transformedUrl || doc.url} alt={doc.alt} />
  }

  // Private file with combined preview (presets + watermark/blur)
  if (doc.previewUrl) {
    return (
      <div>
        <img src={doc.previewUrl} alt={`${doc.alt} - Preview`} />
        <p>Preview with applied transformations and watermark</p>
      </div>
    )
  }

  // Fallback to basic public preview
  if (doc.publicTransformationUrl) {
    return (
      <div>
        <img src={doc.publicTransformationUrl} alt={`${doc.alt} - Preview`} />
        <p>This is a preview. Login to see full quality.</p>
      </div>
    )
  }

  // No preview available
  return <div>Authentication required</div>
}
```

### Gallery with Mixed Public/Private Images

```tsx
import { fetchSignedURLs, requiresSignedURL } from 'payload-storage-cloudinary/client'

function PrivateGallery({ images }) {
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadImages() {
      // Separate private and public images
      const privateImages = images.filter(img => requiresSignedURL(img))
      const publicImages = images.filter(img => !requiresSignedURL(img))

      // Create initial URL map with public images
      const urlMap: Record<string, string> = {}
      publicImages.forEach(img => {
        // Use the best available URL for public images
        urlMap[img.id] = img.transformedUrl || img.url
      })

      // Fetch signed URLs for private images
      if (privateImages.length > 0) {
        const privateIds = privateImages.map(img => img.id)
        const signedUrls = await fetchSignedURLs('media', privateIds)
        Object.assign(urlMap, signedUrls)
      }

      setImageUrls(urlMap)
      setLoading(false)
    }

    loadImages()
  }, [images])

  if (loading) return <div>Loading gallery...</div>

  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map(image => (
        <div key={image.id} className="relative">
          <img 
            src={imageUrls[image.id] || image.publicTransformationUrl || '/placeholder.jpg'}
            alt={image.alt}
            className="w-full h-auto"
          />
          {image.isPrivate && !imageUrls[image.id] && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <span className="text-white">Private Image</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

## Authentication Strategies

### 1. Cookie-based Authentication (Default)

```typescript
// Frontend automatically includes cookies
const url = await fetchSignedURL('media', docId)
```

### 2. JWT Token Authentication

```typescript
// Get token from your auth system
const token = localStorage.getItem('jwt-token')

const url = await fetchSignedURL('media', docId, {
  token: token,
})
```

### 3. Server-Side Rendering (SSR)

```typescript
// In Next.js API route or server component
import { cookies } from 'next/headers'

async function getPrivateImageUrl(docId: string) {
  const cookieStore = cookies()
  const authCookie = cookieStore.get('payload-token')

  return fetchSignedURL('media', docId, {
    baseUrl: process.env.PAYLOAD_PUBLIC_SERVER_URL,
    headers: {
      Cookie: `payload-token=${authCookie?.value}`,
    },
  })
}
```

## Complete Working Example

Here's a full example that works with Next.js App Router:

```tsx
'use client'

import React, { useEffect, useState } from 'react'
import { 
  fetchSignedURL, 
  useSignedURL, 
  requiresSignedURL,
  createPrivateImageComponent,
  getImageURL 
} from 'payload-storage-cloudinary/client'

// Create the component once
const PrivateImage = createPrivateImageComponent(React)

// Example 1: Smart component that handles both public and private
function SmartImageExample({ doc }: { doc: any }) {
  const [url, setUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getImageURL(doc, 'media')
      .then(setUrl)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [doc])

  if (loading) return <div>Loading...</div>
  return <img src={url} alt={doc.alt} />
}

// Example 2: Using the hook for private files
function HookExample({ doc }: { doc: any }) {
  const { url, loading, error } = useSignedURL('media', doc?.id, {
    react: React
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  return <img src={url!} alt={doc.alt} />
}

// Example 3: Using the pre-built component
function ComponentExample({ doc }: { doc: any }) {
  return (
    <PrivateImage 
      doc={doc} 
      collection="media" 
      alt="My image"
      className="w-full h-auto"
      fallback={<div>Loading...</div>}
    />
  )
}

// Example 4: With public preview support
function PreviewExample({ doc }: { doc: any }) {
  if (!doc.isPrivate) {
    return <img src={doc.transformedUrl || doc.url} alt={doc.alt} />
  }

  // Show public preview if available
  if (doc.previewUrl) {
    return (
      <div>
        <img src={doc.previewUrl} alt={`${doc.alt} - Preview`} />
        <p>This is a preview with transformations and watermark</p>
      </div>
    )
  }

  // Use the hook for authenticated access
  return <HookExample doc={doc} />
}
```

## Troubleshooting

### Issue: "Private File" checkbox behavior

**How it works**: 
- When `privateFiles` is enabled, each upload gets a checkbox
- Checked = Private (requires authentication)
- Unchecked = Public (accessible to everyone)
- The plugin respects this per-file setting throughout the system

### Expected HTTP Status Codes

When testing private file access:

**Authenticated users:**
- Direct media access (`/api/media/{id}`): 200 OK
- Signed URL endpoint (`/api/media/signed-url/{id}`): 200 OK with URL

**Unauthenticated users accessing private files:**
- Direct media access: Returns null in afterRead hook
- Signed URL endpoint: 403 Forbidden

### Issue: Getting 403 Forbidden

**Possible causes:**
1. User is not authenticated
2. User doesn't have access to the document
3. JWT token has expired
4. CORS issues with credentials

**Debug steps:**
```typescript
// Check authentication
const response = await fetch('/api/media/signed-url/123', {
  credentials: 'include', // Essential for cookies
})
console.log(response.status, await response.text())
```

### Issue: URL returns 404

**Possible causes:**
1. Document doesn't exist
2. Collection name is wrong
3. API endpoint path is incorrect

**Debug:**
```typescript
// Verify the endpoint
console.log(`/api/${collection}/signed-url/${docId}`)
```

### Issue: Images expire too quickly

**Solution**: Increase the expiration time:
```typescript
privateFiles: {
  enabled: true,
  expiresIn: 86400, // 24 hours
}
```

## Best Practices

1. **Use the right helper**: Use `getImageURL()` for mixed collections, `fetchSignedURL()` for known private files
2. **Handle loading states**: Always show loading states for better UX
3. **Implement error boundaries**: Wrap image components in error boundaries
4. **Cache management**: Store signed URLs in state/cache until close to expiry
5. **Progressive enhancement**: Show public previews while loading full images
6. **Batch loading**: Use batch endpoints for galleries

## Security Considerations

1. **Never expose Cloudinary credentials** in frontend code
2. **Always validate permissions** on the server
3. **Use appropriate expiration times** - shorter is more secure
4. **Monitor usage** for unusual access patterns
5. **Implement rate limiting** on signed URL endpoints
6. **Use HTTPS** for all requests

## Performance Tips

1. **Preload critical images**:
   ```typescript
   const link = document.createElement('link')
   link.rel = 'preload'
   link.as = 'image'
   link.href = await getImageURL(doc, 'media')
   document.head.appendChild(link)
   ```

2. **Use intersection observer** for lazy loading:
   ```typescript
   const observer = new IntersectionObserver((entries) => {
     entries.forEach(entry => {
       if (entry.isIntersecting) {
         loadPrivateImage(entry.target)
       }
     })
   })
   ```

3. **Implement retry logic** for failed requests
4. **Use service workers** for offline support (with careful cache management)
5. **Show public previews** while loading authenticated versions
# Private Images Authorization Guide

A comprehensive guide for implementing and using private images with authentication in Payload CMS with Cloudinary storage.

## Overview

This guide covers everything you need to know about working with private images, including:
- Per-file privacy control
- Authentication and authorization
- Frontend implementation patterns
- Common troubleshooting

## Key Concepts

### Per-File Privacy Control

Unlike collection-level privacy settings, the plugin now supports per-file privacy control:

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

### With Authentication Requirements

```typescript
collections: {
  documents: {
    privateFiles: {
      enabled: true,
      customAuthCheck: (req, doc) => {
        // Require user to be logged in
        return !!req.user
      }
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
        // Custom authorization logic
        if (doc.owner !== req.user?.id) {
          return false
        }
        return true
      },
    },
  },
}
```

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
import { fetchSignedURL } from 'payload-storage-cloudinary/client'

async function displayPrivateImage(docId: string) {
  try {
    // Fetch the signed URL
    const url = await fetchSignedURL('media', docId)
    
    // Display the image
    const img = document.createElement('img')
    img.src = url
    document.body.appendChild(img)
  } catch (error) {
    console.error('Failed to load private image:', error)
  }
}
```

### 2. React Component with Loading State

```tsx
import React, { useState, useEffect } from 'react'
import { fetchSignedURL, requiresSignedURL } from 'payload-storage-cloudinary/client'

function SmartImage({ doc, collection = 'media' }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function loadImage() {
      // Check if this image needs a signed URL
      if (!requiresSignedURL(doc)) {
        setImageUrl(doc.url)
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

### 4. Gallery Implementation

```tsx
import { fetchSignedURLs, requiresSignedURL } from 'payload-storage-cloudinary'

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
        urlMap[img.id] = img.url
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
        <img 
          key={image.id}
          src={imageUrls[image.id]}
          alt={image.alt}
          className="w-full h-auto"
        />
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

## Common Patterns

### 1. Mixed Public/Private Collection

```tsx
function MediaDisplay({ media }) {
  // The helper functions handle both cases
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    getImageURL(media, 'media').then(setUrl)
  }, [media])

  return url ? <img src={url} alt={media.alt} /> : null
}
```

### 2. Conditional Privacy Based on User

```typescript
// In your collection config
privateFiles: {
  enabled: true,
  customAuthCheck: async (req, doc) => {
    // Public for the owner, private for others
    if (doc.owner === req.user?.id) {
      return true
    }
    
    // Check if user has access through sharing
    if (doc.sharedWith?.includes(req.user?.id)) {
      return true
    }
    
    return false
  },
}
```

### 3. Watermarked Public Preview

```typescript
import { getTransformationUrl } from 'payload-storage-cloudinary'

function MediaWithPreview({ media }) {
  const [urls, setUrls] = useState({ preview: null, full: null })

  useEffect(() => {
    async function loadUrls() {
      // Public watermarked preview
      const previewUrl = getTransformationUrl({
        publicId: media.cloudinaryPublicId,
        version: media.cloudinaryVersion,
        customTransformations: {
          overlay: 'watermark',
          gravity: 'center',
          opacity: 30,
        },
      })

      // Full image (might need signed URL)
      const fullUrl = await getImageURL(media, 'media')

      setUrls({ preview: previewUrl, full: fullUrl })
    }

    loadUrls()
  }, [media])

  return (
    <div>
      <img src={urls.preview} alt="Preview" />
      {urls.full && <a href={urls.full}>Download Full Image</a>}
    </div>
  )
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
  createPrivateImageComponent 
} from 'payload-storage-cloudinary/client'

// Create the component once
const PrivateImage = createPrivateImageComponent(React)

// Example 1: Using fetchSignedURL directly
function DirectFetchExample({ docId }: { docId: string }) {
  const [url, setUrl] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSignedURL('documents', docId)
      .then(setUrl)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [docId])

  if (loading) return <div>Loading...</div>
  return <img src={url} alt="Private document" />
}

// Example 2: Using the hook
function HookExample({ docId }: { docId: string }) {
  const { url, loading, error } = useSignedURL('documents', docId, {
    react: React
  })

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  return <img src={url!} alt="Private document" />
}

// Example 3: Using the pre-built component
function ComponentExample({ doc }: { doc: any }) {
  return (
    <PrivateImage 
      doc={doc} 
      collection="documents" 
      alt="Private document"
      fallback={<div>Loading...</div>}
    />
  )
}
```

## Troubleshooting

### Issue: "Private File" checkbox won't uncheck

**Solution**: This has been fixed in the latest version. The upload handler now respects the user's checkbox selection.

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

1. **Cache Management**: Store signed URLs in state/cache until close to expiry
2. **Error Boundaries**: Wrap image components in error boundaries
3. **Loading States**: Always show loading states for better UX
4. **Batch Loading**: Use batch endpoints for galleries
5. **Progressive Enhancement**: Show low-res previews while loading

## Security Considerations

1. **Never expose Cloudinary credentials** in frontend code
2. **Always validate permissions** on the server
3. **Use appropriate expiration times** - shorter is more secure
4. **Monitor usage** for unusual access patterns
5. **Implement rate limiting** on signed URL endpoints

## Performance Tips

1. **Preload critical images**:
   ```typescript
   const link = document.createElement('link')
   link.rel = 'preload'
   link.as = 'image'
   link.href = await fetchSignedURL('media', docId)
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
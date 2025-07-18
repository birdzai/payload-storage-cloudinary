import type { User } from 'payload'

// Type definitions for React-like environments
interface ReactLike {
  useState: <T>(initial: T | (() => T)) => [T, (value: T) => void]
  useEffect: (effect: () => void | (() => void), deps?: any[]) => void
}

/**
 * Client-side helper to fetch a signed URL for a private image
 * @param collection - The collection slug (e.g., 'media', 'documents')
 * @param docId - The document ID
 * @param options - Optional configuration
 * @returns Promise resolving to the signed Cloudinary URL
 */
export async function fetchSignedURL(
  collection: string,
  docId: string,
  options?: {
    /** Custom API base URL (defaults to current origin) */
    baseUrl?: string
    /** Include credentials in the request (defaults to 'same-origin') */
    credentials?: RequestCredentials
    /** Additional headers to include */
    headers?: Record<string, string>
    /** JWT token for authentication (if not using cookies) */
    token?: string
  }
): Promise<string> {
  const baseUrl = options?.baseUrl || ''
  const url = `${baseUrl}/api/${collection}/signed-url/${docId}`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  }
  
  // Add JWT token if provided
  if (options?.token) {
    headers['Authorization'] = `JWT ${options.token}`
  }
  
  const response = await fetch(url, {
    method: 'GET',
    headers,
    credentials: options?.credentials || 'same-origin',
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch signed URL' }))
    throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch signed URL`)
  }
  
  const data = await response.json()
  return data.url
}

/**
 * Batch fetch multiple signed URLs for private images
 * @param collection - The collection slug
 * @param docIds - Array of document IDs
 * @param options - Optional configuration
 * @returns Promise resolving to a map of docId to signed URL
 */
export async function fetchSignedURLs(
  collection: string,
  docIds: string[],
  options?: {
    baseUrl?: string
    credentials?: RequestCredentials
    headers?: Record<string, string>
    token?: string
  }
): Promise<Record<string, string>> {
  const baseUrl = options?.baseUrl || ''
  const url = `${baseUrl}/api/${collection}/signed-urls`
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  }
  
  if (options?.token) {
    headers['Authorization'] = `JWT ${options.token}`
  }
  
  const response = await fetch(url, {
    method: 'POST',
    headers,
    credentials: options?.credentials || 'same-origin',
    body: JSON.stringify({ ids: docIds }),
  })
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch signed URLs' }))
    throw new Error(errorData.message || `HTTP ${response.status}: Failed to fetch signed URLs`)
  }
  
  const data = await response.json()
  return data.urls
}

/**
 * React hook for fetching a signed URL with automatic refetch before expiry
 * Note: This hook requires React to be available in the global scope
 * 
 * @example
 * ```tsx
 * import { useSignedURL } from 'payload-storage-cloudinary'
 * 
 * function MyComponent({ doc }) {
 *   const { url, loading, error } = useSignedURL('media', doc.id)
 *   // ...
 * }
 * ```
 */
export function useSignedURL(
  collection: string,
  docId: string | null | undefined,
  options?: {
    /** Refetch buffer in seconds before URL expires (default: 300 = 5 minutes) */
    refetchBuffer?: number
    /** Other fetch options */
    fetchOptions?: Parameters<typeof fetchSignedURL>[2]
    /** React instance (optional, defaults to window.React) */
    react?: ReactLike
  }
): {
  url: string | null
  loading: boolean
  error: Error | null
} {
  // Return initial state during SSR
  if (typeof window === 'undefined') {
    return {
      url: null,
      loading: true,
      error: null
    }
  }
  
  // Get React from options or global
  const React = options?.react || (window as any).React
  if (!React) {
    throw new Error('React is not available. Please ensure React is loaded or pass it via options.react')
  }
  
  const [url, setUrl] = React.useState(null) as [string | null, (value: string | null) => void]
  const [loading, setLoading] = React.useState(!!docId) as [boolean, (value: boolean) => void]
  const [error, setError] = React.useState(null) as [Error | null, (value: Error | null) => void]
  
  React.useEffect(() => {
    if (!docId) {
      setUrl(null)
      setLoading(false)
      return
    }
    
    let timeoutId: NodeJS.Timeout
    
    const fetchUrl = async () => {
      setLoading(true)
      setError(null)
      
      try {
        const signedUrl = await fetchSignedURL(collection, docId, options?.fetchOptions)
        setUrl(signedUrl)
        
        // Schedule refetch before expiry (default 5 minutes before)
        const refetchBuffer = (options?.refetchBuffer || 300) * 1000
        const expiryTime = 3600 * 1000 // 1 hour default expiry
        const refetchDelay = Math.max(expiryTime - refetchBuffer, 60000) // At least 1 minute
        
        timeoutId = setTimeout(fetchUrl, refetchDelay)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch signed URL'))
        setUrl(null)
      } finally {
        setLoading(false)
      }
    }
    
    fetchUrl()
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [collection, docId])
  
  return { url, loading, error }
}

/**
 * Helper to determine if a document requires a signed URL
 */
export function requiresSignedURL(doc: any): boolean {
  return doc?.requiresSignedURL === true || doc?.isPrivate === true
}

/**
 * Get the appropriate image URL (signed or regular)
 * @param doc - The document object
 * @param collection - The collection slug
 * @param options - Fetch options
 * @returns Promise resolving to the appropriate URL
 */
export async function getImageURL(
  doc: any,
  collection: string,
  options?: Parameters<typeof fetchSignedURL>[2]
): Promise<string> {
  if (requiresSignedURL(doc)) {
    return fetchSignedURL(collection, doc.id, options)
  }
  return doc.url || doc.cloudinaryUrl || ''
}

/**
 * Creates a PrivateImage React component
 * 
 * @example
 * ```tsx
 * import React from 'react'
 * import { createPrivateImageComponent } from 'payload-storage-cloudinary'
 * 
 * const PrivateImage = createPrivateImageComponent(React)
 * 
 * // Use in your app
 * <PrivateImage doc={doc} collection="media" />
 * ```
 */
export function createPrivateImageComponent(React: any) {
  return function PrivateImage({ 
    doc, 
    collection, 
    alt, 
    className, 
    fallback 
  }: {
    doc: any
    collection: string
    alt?: string
    className?: string
    fallback?: any
  }) {
    // Early return if no document
    if (!doc) {
      return null
    }
    
    // Check if the document actually requires a signed URL
    const needsSignedUrl = requiresSignedURL(doc)
    
    // If it doesn't need a signed URL, just use the regular URL
    if (!needsSignedUrl && doc?.url) {
      return React.createElement('img', {
        src: doc.url,
        alt: alt || doc?.alt || '',
        className: className,
        width: doc?.width,
        height: doc?.height
      })
    }
    
    // Otherwise, fetch the signed URL
    const { url, loading, error } = useSignedURL(collection, doc?.id, { react: React })
    
    if (loading) return fallback || React.createElement('div', null, 'Loading...')
    if (error) return React.createElement('div', null, `Error loading image: ${error.message}`)
    if (!url) return null
    
    return React.createElement('img', {
      src: url,
      alt: alt || doc?.alt || '',
      className: className,
      width: doc?.width,
      height: doc?.height
    })
  }
}
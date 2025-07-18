# Public Previews for Private Files

This feature allows you to create public preview URLs with watermarks or blur effects for private files, while keeping the original files protected through Payload's access control.

## Overview

The public preview feature provides two types of public URLs for private files:
- **Basic Public Preview**: Watermarked or blurred version available to everyone
- **Combined Preview**: Applies transformation presets AND watermark/blur effects

## Use Cases

Perfect for scenarios where you want to:
- Show watermarked previews of premium content
- Display blurred previews of private photos
- Allow public browsing with authentication-gated full access
- Create teasers for paid content

## Configuration

### Basic Configuration

```typescript
cloudinaryStorage({
  cloudConfig: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
  collections: {
    media: {
      privateFiles: true, // Enable per-file privacy control
      transformations: {
        preserveOriginal: true, // Recommended for flexibility
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
  },
})
```

### Advanced Configuration with Presets

```typescript
cloudinaryStorage({
  collections: {
    media: {
      privateFiles: true,
      transformations: {
        preserveOriginal: true,
        presets: [
          {
            name: 'card',
            label: 'Card View',
            transformation: {
              width: 400,
              height: 400,
              crop: 'fill',
              gravity: 'auto',
            },
          },
          {
            name: 'hero',
            label: 'Hero Image',
            transformation: {
              width: 1200,
              height: 600,
              crop: 'fill',
              gravity: 'auto',
            },
          },
        ],
        enablePresetSelection: true,
        publicTransformation: {
          enabled: true,
          watermark: {
            defaultText: 'SAMPLE',
            style: {
              fontFamily: 'Arial',
              fontSize: 60,
              color: 'rgb:ffffff',
              opacity: 80,
              angle: 0,
            },
          },
          blur: {
            effect: 'blur:1500',
            quality: 50,
          },
        },
      },
    },
  },
})
```

## How It Works

### Upload Process

1. **Upload File**: User uploads a file to the collection
2. **Privacy Control**: User can check/uncheck "Private File" checkbox
3. **Preset Selection**: User can select transformation presets (if enabled)
4. **Public Preview**: User can enable public preview and choose watermark or blur

### URL Generation

The plugin generates multiple URL fields:

```typescript
{
  // Standard URLs
  url: '...', // Original URL (when preserveOriginal: true)
  originalUrl: '...', // Always the untransformed image
  transformedUrl: '...', // With selected presets applied
  
  // Public preview URLs
  publicTransformationUrl: '...', // Basic watermark/blur preview
  previewUrl: '...', // Combined presets + watermark/blur
  
  // Admin thumbnail
  thumbnailURL: '...', // 150x150 for admin UI
}
```

### Preview Types

1. **Basic Public Preview** (`publicTransformationUrl`):
   - Applies only the watermark or blur effect
   - Available even without transformation presets
   - Good for simple previews

2. **Combined Preview** (`previewUrl`):
   - Applies selected transformation presets PLUS watermark/blur
   - Only available when transformation presets are selected
   - Best for showcasing how transformations look with watermarks

## Admin Interface

The admin interface provides:

1. **Private File Checkbox**: Control file privacy per upload
2. **Transformation Presets**: Multi-select field for presets (if enabled)
3. **Public Preview Toggle**: Enable/disable public previews
4. **Transformation Type**: Choose between watermark and blur

## Frontend Implementation

### Basic Usage

```tsx
function ImageWithPreview({ doc }: { doc: any }) {
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

### Advanced Usage with Combined Previews

```tsx
function AdvancedImageDisplay({ doc }: { doc: any }) {
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

### Gallery with Mixed Content

```tsx
function GalleryWithPreviews({ images }: { images: any[] }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {images.map(image => (
        <div key={image.id} className="relative">
          {!image.isPrivate ? (
            // Public image
            <img 
              src={image.transformedUrl || image.url} 
              alt={image.alt}
              className="w-full h-auto"
            />
          ) : image.previewUrl ? (
            // Private with combined preview
            <div>
              <img 
                src={image.previewUrl} 
                alt={`${image.alt} - Preview`}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <span className="text-white text-sm">Preview</span>
              </div>
            </div>
          ) : image.publicTransformationUrl ? (
            // Private with basic preview
            <div>
              <img 
                src={image.publicTransformationUrl} 
                alt={`${image.alt} - Preview`}
                className="w-full h-auto"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <span className="text-white text-sm">Preview</span>
              </div>
            </div>
          ) : (
            // No preview available
            <div className="bg-gray-200 flex items-center justify-center h-48">
              <span className="text-gray-500">Private</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

## Watermark Configuration

### Text Watermarks

```typescript
watermark: {
  defaultText: 'PREVIEW',
  style: {
    fontFamily: 'Arial', // or 'Times', 'Helvetica', etc.
    fontSize: 50,
    color: 'rgb:808080', // Gray color
    opacity: 50, // 50% transparency
    angle: -45, // Diagonal angle
  },
}
```

### Dynamic Watermarks

Users can customize watermark text through a field in the admin:

```typescript
// The plugin automatically adds a watermark text field
// Users can enter custom text like "SAMPLE", "DRAFT", "PREVIEW"
```

## Blur Configuration

```typescript
blur: {
  effect: 'blur:2000', // Heavy blur (0-2000)
  quality: 30, // Lower quality for previews
}
```

## Important Notes

1. **Upload Method**: Files are uploaded as regular (non-authenticated) resources to Cloudinary when public previews are enabled
2. **Access Control**: Privacy is enforced through Payload's access control, not Cloudinary authentication
3. **URL Generation**: All transformations are applied via URL parameters, not during upload
4. **Re-upload Prevention**: Changing transformation settings won't trigger new uploads

## Best Practices

1. **Use `preserveOriginal: true`** for maximum flexibility
2. **Combine with transformation presets** for sophisticated previews
3. **Test watermark visibility** on different image backgrounds
4. **Consider blur intensity** based on your content
5. **Provide clear authentication prompts** for full access

## Troubleshooting

### Issue: Watermark Not Visible
- Increase opacity (0-100)
- Change color to contrast with image
- Adjust font size
- Try different angles

### Issue: Blur Too Light/Heavy
- Adjust blur value (0-2000)
- Lower quality for more aggressive blur
- Combine with other effects

### Issue: No Public Preview Generated
- Check that `publicTransformation.enabled: true`
- Verify file is marked as private
- Ensure user enabled public preview in admin

### Issue: 401 Errors on Preview URLs
- Verify `preserveOriginal: true` is set
- Check that publicTransformation is properly configured
- Ensure files aren't uploaded with authenticated type
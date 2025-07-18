# Migration Guide

This guide helps you migrate from older configuration formats to the new organized structure and understand the latest features.

## Major Changes in v1.0.7+

### 1. Smart Re-upload Prevention
The plugin now prevents unnecessary re-uploads when updating documents:
- Changing metadata fields (alt text, etc.) won't trigger re-uploads
- Updating transformation presets won't create new files
- Folder path changes use asset moving instead of re-uploading

### 2. Multi-Select Transformation Presets
Transformation presets now support multiple selections:
- Users can select multiple presets that get combined
- All transformations happen via URL parameters (no upload-time transformations)
- Requires `preserveOriginal: true` for best results

### 3. New URL Fields
The plugin now creates multiple URL fields for different use cases:
- `url` - Main URL (original when `preserveOriginal: true`)
- `originalUrl` - Always the untransformed image
- `transformedUrl` - URL with selected transformation presets
- `publicTransformationUrl` - Watermarked/blurred public preview
- `previewUrl` - Combined presets + watermark/blur

## Configuration Changes

### Folder Configuration

**Old:**
```typescript
collections: {
  media: {
    folder: 'uploads',
    enableDynamicFolders: true,
    folderField: 'cloudinaryFolder',
  }
}
```

**New:**
```typescript
collections: {
  media: {
    folder: {
      path: 'uploads',
      enableDynamic: true,
      fieldName: 'cloudinaryFolder',
    }
  }
}
```

**Shorthand (still supported):**
```typescript
collections: {
  media: {
    folder: 'uploads', // Simple string still works
  }
}
```

### Transformation Configuration

**Old:**
```typescript
collections: {
  media: {
    transformations: {
      quality: 'auto',
      fetch_format: 'auto',
    },
    transformationPresets: commonPresets,
    enablePresetSelection: true,
    presetField: 'transformationPreset',
  }
}
```

**New:**
```typescript
collections: {
  media: {
    transformations: {
      default: {
        quality: 'auto',
        fetch_format: 'auto',
      },
      presets: commonPresets,
      enablePresetSelection: true,
      presetFieldName: 'transformationPreset',
      preserveOriginal: true, // Recommended for flexibility
    }
  }
}
```

**Key Changes:**
- `transformationPresets` → `presets`
- `presetField` → `presetFieldName`
- Direct transformations → `default` object
- Added `preserveOriginal` option
- Preset selection now supports `hasMany: true` (multi-select)

### Private Files Configuration

**Old:**
```typescript
collections: {
  documents: {
    privateFiles: true,
    signedURLs: {
      enabled: true,
      expiresIn: 3600,
    }
  }
}
```

**New (simplified):**
```typescript
collections: {
  documents: {
    privateFiles: true, // Automatically enables signed URLs with 1-hour expiry
  }
}

// Or with custom configuration:
collections: {
  documents: {
    privateFiles: {
      enabled: true,
      expiresIn: 7200, // 2 hours
      customAuthCheck: (req) => !!req.user,
    }
  }
}
```

The `signedURLs` field is deprecated and automatically mapped to `privateFiles`.

## New Features

### Public Previews for Private Files

Generate watermarked or blurred public previews of private files:

```typescript
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
}
```

### Multi-Select Transformation Presets

Users can now select multiple transformation presets:

```typescript
// User selects: ["grayscale", "card"]
// Result: Combined transformations applied to transformedUrl field
```

### Smart Asset Moving

When folder paths change, assets are moved instead of re-uploaded:
- Uses Cloudinary's rename API
- Preserves public IDs and versions
- Maintains all URLs and transformations

### Enhanced Upload Queue

Better support for large files:

```typescript
uploadQueue: {
  enabled: true,
  maxConcurrentUploads: 3,
  enableChunkedUploads: true,
  largeFileThreshold: 100, // MB
  chunkSize: 20, // MB chunks
}
```

### Control Cloudinary Deletion

```typescript
collections: {
  media: {
    deleteFromCloudinary: false, // Keep files in Cloudinary when deleted from Payload
  }
}
```

## Breaking Changes

### Transformation Preset Selection

If you were using `enablePresetSelection: true`, the field now supports multiple selections by default. This means:

**Before:**
```typescript
doc.transformationPreset = 'card' // String
```

**After:**
```typescript
doc.transformationPreset = ['card', 'grayscale'] // Array
```

**Migration:** Your frontend code should handle both string and array values:

```typescript
function getPresets(doc: any): string[] {
  const presets = doc.transformationPreset
  return Array.isArray(presets) ? presets : presets ? [presets] : []
}
```

### URL Field Behavior

When `preserveOriginal: true` (recommended):
- `url` always contains the original URL
- `transformedUrl` contains URL with selected presets
- Use `doc.transformedUrl || doc.url` for the best available URL

### Legacy Field Mapping

The plugin automatically maps legacy fields but some may be deprecated:

| Legacy Field | New Field | Status |
|-------------|-----------|---------|
| `transformationPresets` | `presets` | Mapped automatically |
| `presetField` | `presetFieldName` | Mapped automatically |
| `signedURLs` | `privateFiles` | Mapped automatically |
| `enableDynamicFolders` | `enableDynamic` | Mapped automatically |
| `folderField` | `fieldName` | Mapped automatically |

## Frontend Migration

### Update Image Display Logic

**Old:**
```tsx
function ProductImage({ doc }) {
  return <img src={doc.url} alt={doc.alt} />
}
```

**New:**
```tsx
function ProductImage({ doc }) {
  // Use transformedUrl if available, otherwise use url
  const imageUrl = doc.transformedUrl || doc.url
  return <img src={imageUrl} alt={doc.alt} />
}
```

### Handle Private Files

**Old:**
```tsx
// Manual signed URL fetching
```

**New:**
```tsx
import { useSignedURL } from 'payload-storage-cloudinary/client'

function PrivateImage({ doc }) {
  const { url, loading, error } = useSignedURL('media', doc?.id)
  
  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  
  return url ? <img src={url} alt={doc.alt} /> : null
}
```

## Recommended Configuration

For new projects, we recommend this configuration:

```typescript
cloudinaryStorage({
  cloudConfig: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
  },
  collections: {
    media: {
      folder: {
        path: 'uploads',
        enableDynamic: true,
      },
      transformations: {
        default: {
          quality: 'auto',
          fetch_format: 'auto',
        },
        presets: commonPresets,
        enablePresetSelection: true,
        preserveOriginal: true, // Recommended
      },
      privateFiles: true, // Enable per-file privacy control
      uploadQueue: {
        enabled: true,
        enableChunkedUploads: true,
        largeFileThreshold: 100,
      },
      resourceType: 'auto',
      deleteFromCloudinary: true,
    },
  },
})
```

## Testing Your Migration

1. **Upload Prevention**: Update a document's metadata - verify no re-upload occurs
2. **Multi-Select**: Select multiple transformation presets - verify they combine correctly
3. **URL Fields**: Check that `transformedUrl` appears when presets are selected
4. **Private Files**: Test the privacy checkbox and signed URL generation
5. **Folder Changes**: Change a folder path - verify the asset moves instead of re-uploading

## Backward Compatibility

The plugin maintains full backward compatibility:
- All old configuration formats still work
- Existing fields and data remain unchanged
- Migration is optional and can be done gradually
- No data loss during updates

## Support

If you encounter issues during migration:
- Check the console for helpful migration warnings
- Review the updated documentation
- Test with a small subset of files first
- Consider using `deleteFromCloudinary: false` during migration for safety
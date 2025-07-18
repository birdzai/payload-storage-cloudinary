# Watermark Configuration

The plugin supports advanced watermark functionality for public previews of private files. This allows you to create watermarked versions that anyone can view while keeping the original files private.

## Basic Configuration

```typescript
cloudinaryStorage({
  collections: {
    media: {
      privateFiles: true,
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

## Watermark Style Options

### Text Watermark Configuration

The text watermark supports the following style options:

- `fontFamily`: Font to use (e.g., 'Arial', 'Verdana', 'Times New Roman')
- `fontSize`: Size of the text (default: 50)
- `color`: Text color in RGB format (e.g., 'rgb:808080' for gray)
- `opacity`: Transparency level 0-100 (default: 50)
- `angle`: Rotation angle (default: -45 for diagonal)

### Advanced Watermark Configuration

```typescript
watermark: {
  defaultText: 'SAMPLE',
  style: {
    fontFamily: 'Arial',
    fontSize: 60,
    color: 'rgb:ffffff', // White text
    opacity: 80,
    angle: 0, // No rotation
  },
}
```

### Blur Alternative

You can use blur instead of watermarks for public previews:

```typescript
blur: {
  effect: 'blur:1500', // Blur intensity (0-2000)
  quality: 50, // Image quality for preview
}
```

## How It Works

1. **Upload a file** with "Private File" checked
2. **Enable Public Preview** using the checkbox
3. **Choose transformation type**: watermark or blur
4. **Enter watermark text** (or use the default)
5. **Plugin generates** a public URL with the watermark/blur applied

## Admin Interface

The plugin automatically adds these fields to your admin interface:

- **Private File**: Checkbox to control file privacy
- **Enable Public Preview**: Toggle for public previews
- **Transformation Type**: Choose between watermark and blur
- **Watermark Text**: Custom text field (when watermark is selected)

## URL Generation

The plugin generates multiple URL fields:

- `publicTransformationUrl`: Basic watermark or blur preview
- `previewUrl`: Combined transformation presets + watermark/blur

### Example Watermark URL Structure

```
https://res.cloudinary.com/[cloud]/image/upload/
l_text:Arial_50:[watermark_text]/
co_rgb:808080,a_-45,o_50/
fl_layer_apply/
v[version]/[public_id].[format]
```

## Frontend Usage

### Basic Usage

```tsx
function ImageWithPreview({ doc }) {
  if (!doc.isPrivate) {
    // Public file - use transformed URL if available
    return <img src={doc.transformedUrl || doc.url} alt={doc.alt} />
  }
  
  // Private file - show public preview if available
  if (doc.publicTransformationUrl) {
    return (
      <div>
        <img src={doc.publicTransformationUrl} alt={`${doc.alt} - Preview`} />
        <p>This is a watermarked preview. Login to see the original.</p>
      </div>
    )
  }
  
  // No preview available
  return <div>Authentication required</div>
}
```

### With Combined Presets

```tsx
function AdvancedImageDisplay({ doc }) {
  if (!doc.isPrivate) {
    return <img src={doc.transformedUrl || doc.url} alt={doc.alt} />
  }
  
  // Use combined preview (presets + watermark/blur)
  if (doc.previewUrl) {
    return (
      <div>
        <img src={doc.previewUrl} alt={`${doc.alt} - Preview`} />
        <p>Preview with transformations and watermark</p>
      </div>
    )
  }
  
  // Fallback to basic preview
  if (doc.publicTransformationUrl) {
    return <img src={doc.publicTransformationUrl} alt={`${doc.alt} - Preview`} />
  }
  
  return <div>Authentication required</div>
}
```

## Complete Configuration Example

```typescript
cloudinaryStorage({
  collections: {
    media: {
      privateFiles: true,
      transformations: {
        preserveOriginal: true,
        
        // Transformation presets
        presets: [
          {
            name: 'card',
            label: 'Card View',
            transformation: {
              width: 400,
              height: 400,
              crop: 'fill',
            },
          },
        ],
        enablePresetSelection: true,
        
        // Public previews
        publicTransformation: {
          enabled: true,
          watermark: {
            defaultText: 'SAMPLE',
            style: {
              fontFamily: 'Arial',
              fontSize: 60,
              color: 'rgb:ffffff',
              opacity: 80,
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

## Troubleshooting

### Watermark Not Visible
- Increase opacity (0-100)
- Change color to contrast with image background
- Adjust font size for better visibility
- Try different angles (-45, 0, 45)

### Blur Too Light/Heavy
- Adjust blur value (0-2000)
- Lower quality for more aggressive blur
- Consider combining with other effects

### No Preview URL Generated
- Verify `publicTransformation.enabled: true`
- Check that file is marked as private
- Ensure user enabled public preview in admin interface
# Upload Queue System

The upload queue system provides efficient handling of large file uploads with progress tracking, concurrent upload management, and chunked uploads for very large files.

## Configuration

Enable the upload queue in your collection configuration:

```typescript
cloudinaryStorage({
  collections: {
    media: {
      uploadQueue: {
        enabled: true,
        maxConcurrentUploads: 3,
        chunkSize: 20, // MB
        enableChunkedUploads: true,
        largeFileThreshold: 100, // MB
      },
    },
  },
})
```

## Configuration Options

- **enabled** (boolean): Enable/disable the upload queue
- **maxConcurrentUploads** (number): Maximum simultaneous uploads (default: 3)
- **chunkSize** (number): Size of chunks in MB for large files (default: 20)
- **enableChunkedUploads** (boolean): Enable chunked uploads for large files (default: true)
- **largeFileThreshold** (number): File size in MB above which to use chunked upload (default: 100)

## Features

### 1. Concurrent Upload Management

The queue system manages multiple uploads simultaneously while preventing system overload:

```typescript
uploadQueue: {
  enabled: true,
  maxConcurrentUploads: 5, // Process up to 5 uploads at once
}
```

### 2. Chunked Uploads for Large Files

Large files are automatically handled with chunked uploads for better reliability:

```typescript
uploadQueue: {
  chunkSize: 50, // 50MB chunks
  largeFileThreshold: 200, // Files > 200MB use chunked upload
  enableChunkedUploads: true,
}
```

### 3. Improved Error Handling

The queue system provides better error handling and timeout management:

```typescript
uploadQueue: {
  enabled: true,
  uploadTimeout: 600000, // 10 minutes timeout for large files
}
```

### 4. Large File Support

Handles files up to several gigabytes with automatic chunking and extended timeouts.

## Usage Examples

### Basic Configuration

```typescript
collections: {
  media: {
    uploadQueue: {
      enabled: true,
    },
  },
}
```

### Advanced Configuration for Videos

```typescript
collections: {
  videos: {
    uploadQueue: {
      enabled: true,
      maxConcurrentUploads: 2, // Limit concurrent video uploads
      chunkSize: 100, // Larger chunks for videos
      largeFileThreshold: 500, // Videos > 500MB use chunked upload
    },
  },
}
```

### How It Works

The upload queue system works behind the scenes to:

1. **Detect Large Files**: Files over the threshold automatically use chunked uploads
2. **Extended Timeouts**: Large files get longer upload timeouts (up to 10 minutes)
3. **Better Error Messages**: More descriptive error messages for upload failures
4. **Automatic Retries**: Failed chunks are retried automatically

### Configuration for Different Use Cases

```typescript
// For documents and images
uploadQueue: {
  enabled: true,
  largeFileThreshold: 50, // 50MB threshold
  chunkSize: 10, // 10MB chunks
}

// For videos and large media
uploadQueue: {
  enabled: true,
  largeFileThreshold: 500, // 500MB threshold
  chunkSize: 100, // 100MB chunks
  maxConcurrentUploads: 2, // Limit concurrent large uploads
}
```

## Benefits

1. **Reliability**: Chunked uploads handle network interruptions better
2. **Large File Support**: Handles files up to several gigabytes
3. **Better Error Handling**: More descriptive error messages and automatic retries
4. **Performance**: Optimized for different file sizes and types
5. **Timeout Management**: Extended timeouts for large files prevent premature failures

## Best Practices

1. **File Size Limits**: Set appropriate thresholds based on your server capacity and typical file sizes
2. **Concurrent Uploads**: Balance between speed and server load (2-5 concurrent uploads recommended)
3. **Chunk Size**: Larger chunks = fewer requests, smaller chunks = better recovery from failures
4. **Resource Types**: Consider different settings for images vs. videos vs. documents
5. **Error Handling**: Provide clear feedback for failed uploads in your UI

## Configuration Examples

### For General Media Collection

```typescript
collections: {
  media: {
    uploadQueue: {
      enabled: true,
      largeFileThreshold: 100, // 100MB threshold
      chunkSize: 20, // 20MB chunks
      maxConcurrentUploads: 3,
    },
  },
}
```

### For Video Collection

```typescript
collections: {
  videos: {
    uploadQueue: {
      enabled: true,
      largeFileThreshold: 500, // 500MB threshold
      chunkSize: 100, // 100MB chunks
      maxConcurrentUploads: 2, // Limit concurrent video uploads
    },
  },
}
```

### For Document Collection

```typescript
collections: {
  documents: {
    uploadQueue: {
      enabled: true,
      largeFileThreshold: 50, // 50MB threshold
      chunkSize: 10, // 10MB chunks
      maxConcurrentUploads: 5,
    },
  },
}
```

## Technical Details

The upload queue system uses Cloudinary's chunked upload API for large files and provides:

- **Automatic Chunking**: Files over the threshold are automatically split into chunks
- **Extended Timeouts**: 10-minute timeout for large file uploads
- **Error Recovery**: Automatic retry for failed chunks
- **Progress Tracking**: Internal progress tracking (not exposed to UI by default)

## Implementation Notes

- The queue is processed in the background during the upload process
- Large files automatically trigger chunked uploads without user intervention
- All configuration is optional - the system works with sensible defaults
- The feature is designed to be transparent to end users
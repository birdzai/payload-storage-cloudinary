# Custom Folder Selection Field Example

**Important**: The built-in folder dropdown feature has been removed from the plugin due to Payload v3 form state integration issues. The current plugin only supports text input for dynamic folders (`enableDynamic: true`).

This example shows how you can implement your own custom folder selection field if you need dropdown functionality. However, for most use cases, the built-in text input with `enableDynamic: true` is sufficient and easier to maintain.

## Implementation

### 1. Create the Server Component (`field.tsx`)

```typescript
import { v2 as cloudinary } from 'cloudinary'
import { FieldClient } from './field.client'

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
    api_key: process.env.CLOUDINARY_API_KEY!,
    api_secret: process.env.CLOUDINARY_API_SECRET!,
})

async function getAllCloudinaryFolders() {
    try {
        const result = await cloudinary.api.root_folders()
        return result.folders
    } catch (error) {
        console.error(error)
        throw error
    }
}

async function getSubfolders(folderPath: string) {
    try {
        const result = await cloudinary.api.sub_folders(folderPath)
        return result.folders
    } catch (error) {
        console.error(error)
        throw error
    }
}

async function getAllFoldersRecursively(path: string = '', depth: number = 0): Promise<any[]> {
    const allFolders = []
    
    try {
        const folders = path === '' 
            ? await getAllCloudinaryFolders()
            : await getSubfolders(path)

        for (const folder of folders) {
            const indent = '  '.repeat(depth)
            const icon = depth > 0 ? '└─ ' : ''

            const displayName = depth > 0 ? folder.path : folder.name
            
            allFolders.push({
                label: `${indent}${icon}${displayName}`,
                value: folder.path,
            })

            const subfolders = await getAllFoldersRecursively(folder.path, depth + 1)
            allFolders.push(...subfolders)
        }
    } catch (error) {
        console.error(`Error fetching folders for path "${path}":`, error)
    }
    
    return allFolders
}

export async function selectField() {
    const rootFolder = {
        label: '/ (root)',
        value: ''
    }
    
    const folders = [rootFolder, ...(await getAllFoldersRecursively())]
    return <FieldClient folders={folders} />
}
```

### 2. Create the Client Component (`field.client.tsx`)

```typescript
'use client'
import { FieldLabel, SelectInput, TextInput, useField } from "@payloadcms/ui";
import { OptionObject } from "payload";
import { useState } from "react";

export const FieldClient = ({ folders }: { folders: OptionObject[] }) => {
    const { path, setValue, value } = useField();
    const [folderMode, setFolderMode] = useState<'existing' | 'new'>('existing');
    
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <FieldLabel label={path}/>
            
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                        type="radio"
                        name={`${path}_mode`}
                        value="existing"
                        checked={folderMode === 'existing'}
                        onChange={() => setFolderMode('existing')}
                    />
                    Select existing folder
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                        type="radio"
                        name={`${path}_mode`}
                        value="new"
                        checked={folderMode === 'new'}
                        onChange={() => setFolderMode('new')}
                    />
                    Create new folder
                </label>
            </div>
            
            {folderMode === 'existing' ? (
                <SelectInput
                    path={path}
                    name={path}
                    value={value as string}
                    options={folders}
                    onChange={(e: any) => setValue(e.value)}
                />
            ) : (
                <TextInput
                    path={path}
                    value={value as string}
                    placeholder="Enter folder path (e.g., products/2024)"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
                />
            )}
        </div>
    );
}
```

### 3. Use in Your Collection

```typescript
{
    slug: 'media',
    upload: {
        disableLocalStorage: true,
    },
    fields: [
        {
            name: 'alt',
            type: 'text',
        },
        {
            name: 'cloudinaryFolder',
            type: 'text',
            admin: {
                components: {
                    Field: '/src/components/field.tsx#selectField'
                }
            }
        }
    ],
}
```

## Recommended Approach

Instead of implementing a custom dropdown, we recommend using the built-in dynamic folder functionality:

```typescript
// Plugin configuration
cloudinaryStorage({
  collections: {
    media: {
      folder: {
        path: 'uploads', // Default folder
        enableDynamic: true, // Enable text input for folders
      },
    },
  },
})
```

This automatically adds a text field where users can enter folder paths like:
- `products/electronics`
- `blog/2024/july`
- `team/marketing`

## Benefits of Text Input Approach

1. **Simplicity**: No complex form state management
2. **Flexibility**: Users can create any folder structure
3. **Performance**: No API calls to fetch folder lists
4. **Reliability**: No dependency on Cloudinary API availability
5. **Validation**: Automatic path validation and cleanup

## Notes on Custom Implementation

If you do implement the custom dropdown field:

- The folder list is cached for 5 minutes to reduce API calls
- Folders are displayed hierarchically with visual indicators
- Users can switch between selecting existing folders and creating new ones
- The field value is stored as the folder path string
- You'll need to handle Cloudinary API rate limits and errors
- Consider the performance impact of fetching folder lists on every page load

## Migration from Dropdown to Text Input

If you were using the old dropdown feature, migration is straightforward:

1. Remove any custom folder selection components
2. Update your plugin configuration to use `enableDynamic: true`
3. The text input provides the same functionality with better UX
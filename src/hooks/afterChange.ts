import type { CollectionAfterChangeHook } from 'payload'
import type { CloudinaryCollectionConfig } from '../types.js'
import { v2 as cloudinary } from 'cloudinary'
import { generateSignedURL } from '../helpers/signedURLs.js'
import { getSignedURLConfig, getTransformationConfig } from '../helpers/normalizeConfig.js'
import { buildWatermarkTransformation, buildImageWatermarkTransformation, buildBlurTransformation } from '../helpers/watermark.js'

export const createAfterChangeHook = (
  _collectionSlug: string,
  config: CloudinaryCollectionConfig
): CollectionAfterChangeHook => async ({ doc, previousDoc }) => {
  // Check if we need to update URLs
  const privacyChanged = previousDoc?.isPrivate !== doc.isPrivate
  const transformConfig = getTransformationConfig(config)
  const presetFieldName = transformConfig.presetFieldName || 'transformationPreset'
  // For hasMany fields, we need to compare arrays properly
  const currentPresets = doc[presetFieldName]
  const previousPresets = previousDoc?.[presetFieldName]
  const presetChanged = JSON.stringify(currentPresets) !== JSON.stringify(previousPresets)
  const publicPreviewFieldName = transformConfig.publicTransformation?.fieldName || 'hasPublicTransformation'
  const publicPreviewChanged = previousDoc?.[publicPreviewFieldName] !== doc[publicPreviewFieldName]
  const watermarkFieldName = transformConfig.publicTransformation?.watermark?.textFieldName || 'watermarkText'
  const watermarkChanged = previousDoc?.[watermarkFieldName] !== doc[watermarkFieldName]
  const typeFieldName = transformConfig.publicTransformation?.typeFieldName || 'transformationType'
  const typeChanged = previousDoc?.[typeFieldName] !== doc[typeFieldName]
  
  if (!doc.cloudinaryPublicId || (!privacyChanged && !presetChanged && !publicPreviewChanged && !watermarkChanged && !typeChanged)) {
    return doc
  }
  
  const signedURLConfig = getSignedURLConfig(config)
  
  // Only update main URLs if privacy changed
  if (privacyChanged) {
    // Update URLs based on new privacy settings
    if (doc.isPrivate && signedURLConfig) {
      // File is now private - generate signed URLs
      doc.requiresSignedURL = true
      
      // Update the main URL to be a signed URL
      doc.url = generateSignedURL({
        publicId: doc.cloudinaryPublicId,
        version: doc.cloudinaryVersion,
        resourceType: doc.cloudinaryResourceType,
        format: doc.cloudinaryFormat,
        transformations: transformConfig.default,
      }, signedURLConfig)
      
      // Update original URL to be signed as well
      doc.originalUrl = generateSignedURL({
        publicId: doc.cloudinaryPublicId,
        version: doc.cloudinaryVersion,
        resourceType: doc.cloudinaryResourceType,
        format: doc.cloudinaryFormat,
        // No transformations for original
      }, signedURLConfig)
      
    } else {
      // File is now public - generate regular URLs
      doc.requiresSignedURL = false
      
      // Update the main URL to be a regular URL
      if (transformConfig.default && Object.keys(transformConfig.default).length > 0) {
        doc.url = cloudinary.url(doc.cloudinaryPublicId, {
          secure: true,
          version: doc.cloudinaryVersion,
          resource_type: doc.cloudinaryResourceType,
          transformation: transformConfig.default,
        })
      } else {
        doc.url = cloudinary.url(doc.cloudinaryPublicId, {
          secure: true,
          version: doc.cloudinaryVersion,
          resource_type: doc.cloudinaryResourceType,
        })
      }
      
      // Update original URL to be a regular URL
      doc.originalUrl = cloudinary.url(doc.cloudinaryPublicId, {
        secure: true,
        version: doc.cloudinaryVersion,
        resource_type: doc.cloudinaryResourceType,
        type: 'upload',
        format: doc.cloudinaryFormat,
      })
    }
  }
  
  // Update URL if preset changed and preserveOriginal is true
  if (transformConfig.preserveOriginal && transformConfig.enablePresetSelection && presetChanged) {
    // Build combined transformations from selected presets
    let combinedTransformations: Record<string, any> = {}
    
    // Start with default transformations if any
    if (transformConfig.default) {
      combinedTransformations = { ...transformConfig.default }
    }
    
    // Add transformations from selected presets
    if (doc[presetFieldName] && transformConfig.presets) {
      // Handle both single and multiple selections
      const presetArray = Array.isArray(doc[presetFieldName]) ? doc[presetFieldName] : [doc[presetFieldName]]
      
      for (const presetName of presetArray) {
        const preset = transformConfig.presets.find(p => p.name === presetName)
        if (preset) {
          // Merge transformations (later presets override earlier ones)
          combinedTransformations = { ...combinedTransformations, ...preset.transformations }
        }
      }
    }
    
    // Generate the URL based on whether we have transformations and privacy settings
    if (Object.keys(combinedTransformations).length > 0) {
      // Generate URL with transformations
      if (doc.isPrivate && signedURLConfig) {
        // Generate signed URL with transformations
        doc.transformedUrl = generateSignedURL({
          publicId: doc.cloudinaryPublicId,
          version: doc.cloudinaryVersion,
          resourceType: doc.cloudinaryResourceType,
          format: doc.cloudinaryFormat,
          transformations: combinedTransformations,
        }, signedURLConfig)
      } else {
        // Generate public URL with transformations
        doc.transformedUrl = cloudinary.url(doc.cloudinaryPublicId, {
          secure: true,
          version: doc.cloudinaryVersion,
          resource_type: doc.cloudinaryResourceType || 'image',
          transformation: combinedTransformations,
        })
      }
    } else {
      // No transformations selected, clear the transformed URL
      doc.transformedUrl = null
    }
  }
  
  // Update public transformation URL if needed
  if (transformConfig.publicTransformation?.enabled && (publicPreviewChanged || watermarkChanged || typeChanged)) {
    const fieldName = transformConfig.publicTransformation.fieldName || 'hasPublicTransformation'
    
    if (doc[fieldName] === true && doc.isPrivate) {
      let publicTransformation
      
      // Get the transformation type
      const typeFieldName = transformConfig.publicTransformation.typeFieldName || 'transformationType'
      const transformationType = doc[typeFieldName] || 'watermark'
      
      if (transformationType === 'watermark' && transformConfig.publicTransformation.watermark) {
        const watermarkFieldName = transformConfig.publicTransformation.watermark.textFieldName || 'watermarkText'
        const watermarkText = doc[watermarkFieldName]
        
        // Build watermark transformation
        if (transformConfig.publicTransformation.watermark.imageId) {
          publicTransformation = buildImageWatermarkTransformation(transformConfig.publicTransformation.watermark)
        } else {
          publicTransformation = buildWatermarkTransformation(
            transformConfig.publicTransformation.watermark,
            watermarkText
          )
        }
      } else if (transformationType === 'blur') {
        // Build blur transformation
        publicTransformation = buildBlurTransformation(transformConfig.publicTransformation.blur)
      }
      
      // Public transformation URL should always be public (no auth)
      doc.publicTransformationUrl = cloudinary.url(doc.cloudinaryPublicId, {
        secure: true,
        version: doc.cloudinaryVersion,
        resource_type: doc.cloudinaryResourceType,
        type: 'upload', // Always use 'upload' for public URLs
        format: doc.cloudinaryFormat,
        transformation: publicTransformation,
      })
    } else {
      doc.publicTransformationUrl = null
    }
  }
  
  // Generate preview URL with transformation presets if public transformation is enabled and any relevant field changed
  if (transformConfig.publicTransformation?.enabled && doc.isPrivate && doc[publicPreviewFieldName] === true && 
      (presetChanged || publicPreviewChanged || watermarkChanged || typeChanged)) {
    const selectedPresets = doc[presetFieldName]
    
    if (selectedPresets) {
      // Build combined transformations from selected presets
      let previewTransformations: Record<string, any> = {}
      
      // Start with default transformations if any
      if (transformConfig.default) {
        previewTransformations = { ...transformConfig.default }
      }
      
      // Add transformations from selected presets
      if (transformConfig.presets) {
        // Handle both single and multiple selections
        const presetArray = Array.isArray(selectedPresets) ? selectedPresets : [selectedPresets]
        
        for (const presetName of presetArray) {
          const preset = transformConfig.presets.find(p => p.name === presetName)
          if (preset) {
            // Merge transformations (later presets override earlier ones)
            previewTransformations = { ...previewTransformations, ...preset.transformations }
          }
        }
      }
      
      // Get the transformation type (watermark/blur)
      const transformationType = doc[typeFieldName] || 'watermark'
      
      // Build the public transformation (watermark/blur)
      let publicTransformation
      if (transformationType === 'watermark' && transformConfig.publicTransformation.watermark) {
        const watermarkText = doc[watermarkFieldName]
        
        if (transformConfig.publicTransformation.watermark.imageId) {
          publicTransformation = buildImageWatermarkTransformation(transformConfig.publicTransformation.watermark)
        } else {
          publicTransformation = buildWatermarkTransformation(
            transformConfig.publicTransformation.watermark,
            watermarkText
          )
        }
      } else if (transformationType === 'blur') {
        publicTransformation = buildBlurTransformation(transformConfig.publicTransformation.blur)
      }
      
      // Combine preset transformations with public transformation
      if (Object.keys(previewTransformations).length > 0 || publicTransformation) {
        // Cloudinary applies transformations in order, so we apply presets first, then watermark/blur
        const combinedTransformation = []
        
        // Add preset transformations first
        if (Object.keys(previewTransformations).length > 0) {
          combinedTransformation.push(previewTransformations)
        }
        
        // Add public transformation (watermark/blur) on top
        if (publicTransformation) {
          if (Array.isArray(publicTransformation)) {
            combinedTransformation.push(...publicTransformation)
          } else {
            combinedTransformation.push(publicTransformation)
          }
        }
        
        doc.previewUrl = cloudinary.url(doc.cloudinaryPublicId, {
          secure: true,
          version: doc.cloudinaryVersion,
          resource_type: doc.cloudinaryResourceType || 'image',
          type: 'upload', // Always use 'upload' for public URLs
          transformation: combinedTransformation,
        })
      } else {
        doc.previewUrl = null
      }
    }
  }
  
  return doc
}
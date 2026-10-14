import { sharpTransformer } from '@payloadcms/transformer-sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { CollectionConfig } from 'payload'
import { pngUpload, startPayload, type PayloadHarness, type TestUser } from './harness'

const readable = (slug: string): CollectionConfig => ({
  slug,
  upload: true,
  access: { read: () => true },
  fields: [],
})

// Enlarged so the 1x1 test image still gets every variant
const variants = [
  { name: 'thumb', width: 40, height: 30, withoutEnlargement: false },
  { name: 'wide', width: 80, withoutEnlargement: false },
]

describe('variant URLs', () => {
  let harness: PayloadHarness
  let user: TestUser

  beforeAll(async () => {
    harness = await startPayload({
      collections: [readable('sized'), readable('defaults')],
      pluginCollections: {
        sized: true,
        defaults: { transformations: { default: { quality: 'auto' } } },
      },
      upload: {
        transformers: [
          sharpTransformer({ collections: { sized: { variants }, defaults: { variants } } }),
        ],
      },
    })
    user = await harness.createUser()
  })

  afterAll(async () => {
    await harness?.stop()
  })

  const upload = async (collection: string) => {
    const res = await harness.request(`/api/${collection}`, {
      method: 'POST',
      body: pngUpload(`${collection}.png`),
      user,
    })
    expect(res.status).toBe(201)
    const { doc } = await res.json()
    const read = await harness.request(`/api/${collection}/${doc.id}`, {})
    expect(read.status).toBe(200)
    return read.json()
  }

  it('serves each variant at the size the transformer produced', async () => {
    const doc = await upload('sized')

    expect(doc.variants.thumb.url).toContain(`/c_fill,h_30,w_40/`)
    expect(doc.variants.thumb.url).toContain(doc.cloudinaryPublicId)
    // A width-only variant keeps the image's proportions: the square source gives 80x80
    expect(doc.variants.wide.url).toContain(`/c_fill,h_80,w_80/`)
    expect(doc.url).not.toContain('c_fill')
    expect(doc.original.url).not.toContain('c_fill')
  })

  it('resizes before the collection default transformation', async () => {
    const doc = await upload('defaults')

    expect(doc.variants.thumb.url).toContain(`/c_fill,h_30,w_40/q_auto/`)
    expect(doc.url).toContain('/q_auto/')
    expect(doc.url).not.toContain('c_fill')
  })
})

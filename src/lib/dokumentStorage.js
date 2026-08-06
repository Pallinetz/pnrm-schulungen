import { supabase } from './supabase'

const BUCKET = 'wissen-dokumente'

export async function uploadDokument(file, onProgress) {
  const ext = file.name.split('.').pop().toLowerCase()
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${Date.now()}_${safeName}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: (p) => onProgress?.(Math.round((p.loaded / p.total) * 100)),
    })

  if (error) throw error

  return { path, name: file.name, ext }
}

export async function deleteDokument(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

// Bucket ist privat -- Downloads laufen ueber zeitlich begrenzte signierte URLs,
// nicht mehr ueber eine feste Public-URL.
export async function getSignedUrl(path, expiresInSeconds = 60) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

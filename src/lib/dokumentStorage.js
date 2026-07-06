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

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, publicUrl: data.publicUrl, name: file.name, ext }
}

export async function deleteDokument(path) {
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) throw error
}

export function getPublicUrl(path) {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

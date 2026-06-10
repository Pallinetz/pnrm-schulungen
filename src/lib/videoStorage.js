import { supabase } from './supabase'

export async function uploadVideo(file, onProgress) {
  const ext = file.name.split('.').pop()
  const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const path = `uploads/${fileName}`

  const { error } = await supabase.storage
    .from('videos')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      onUploadProgress: (p) => onProgress?.(Math.round((p.loaded / p.total) * 100)),
    })

  if (error) throw error

  const { data, error: urlError } = await supabase.storage
    .from('videos')
    .createSignedUrl(path, 60 * 60 * 24 * 7)

  if (urlError) throw urlError
  return { path, signedUrl: data.signedUrl }
}

export async function getSignedVideoUrl(path) {
  const { data, error } = await supabase.storage
    .from('videos')
    .createSignedUrl(path, 60 * 60 * 24 * 7)
  if (error) throw error
  return data.signedUrl
}

export async function deleteVideo(path) {
  const { error } = await supabase.storage.from('videos').remove([path])
  if (error) throw error
}

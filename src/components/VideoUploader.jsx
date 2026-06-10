import { useState, useRef } from 'react'
import { uploadVideo } from '../lib/videoStorage'

const C = { blue: '#2459b8', bad: { bg: '#fff1f0', border: '#ffccc7', text: '#842029' } }

export function VideoUploader({ onUploaded, label = 'Video hochladen' }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const inputRef = useRef()

  async function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setError(null)
    setUploading(true)
    setProgress(0)
    try {
      const result = await uploadVideo(file, setProgress)
      onUploaded({ path: result.path, url: result.signedUrl, name: file.name })
    } catch (err) {
      setError('Upload fehlgeschlagen: ' + err.message)
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/webm,video/ogg,video/quicktime"
        style={{ display: 'none' }}
        onChange={handleFile}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        style={{
          appearance: 'none', border: `1px solid ${C.blue}`, borderRadius: 10,
          background: '#eef5ff', color: '#1f365f', padding: '9px 16px',
          fontWeight: 700, fontSize: 14, cursor: uploading ? 'not-allowed' : 'pointer',
          opacity: uploading ? 0.65 : 1, fontFamily: 'inherit',
        }}
      >
        {uploading ? `Wird hochgeladen… ${progress}%` : label}
      </button>
      {uploading && (
        <div style={{ height: 8, background: '#e7edf7', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.blue, width: `${progress}%`, transition: 'width .3s ease', borderRadius: 999 }} />
        </div>
      )}
      {error && <p style={{ margin: 0, color: C.bad.text, fontSize: 13 }}>{error}</p>}
    </div>
  )
}

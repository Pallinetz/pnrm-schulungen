export function VideoPlayer({ url, titel }) {
  if (!url) return null
  return (
    <div style={{ margin: '12px 0' }}>
      {titel && (
        <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 600, color: '#5f6d82' }}>{titel}</p>
      )}
      <video
        controls
        style={{
          width: '100%', maxHeight: 480, borderRadius: 10,
          border: '1px solid #d7e0ec', background: '#000', display: 'block',
        }}
      >
        <source src={url} type="video/mp4" />
        <source src={url} type="video/webm" />
        Dein Browser unterstützt keine Video-Wiedergabe.
      </video>
    </div>
  )
}

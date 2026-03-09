import { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'https://clipdrop-backend.onrender.com'

const PLATFORMS = [
  { name: 'YouTube', icon: '▶' },
  { name: 'Instagram', icon: '◈' },
  { name: 'TikTok', icon: '♪' },
  { name: 'Twitter', icon: '✦' },
  { name: 'Facebook', icon: '◉' },
  { name: 'Vimeo', icon: '◐' },
  { name: '1000+ more', icon: '∞' },
]

const QUALITIES = [
  { label: 'Best',   value: 'best',  icon: '✦' },
  { label: '1080p',  value: '1080',  icon: '◈' },
  { label: '720p',   value: '720',   icon: '◇' },
  { label: '480p',   value: '480',   icon: '○' },
  { label: 'Audio',  value: 'audio', icon: '♪' },
]

const FORMATS = [
  { label: 'Video',    value: 'video' },
  { label: 'Audio',    value: 'audio' },
  { label: 'Playlist', value: 'playlist' },
]

function formatDuration(sec) {
  if (!sec) return ''
  const m = Math.floor(sec / 60), s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(n) {
  if (!n) return ''
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M views`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}K views`
  return `${n} views`
}

export default function App() {
  const [url, setUrl]           = useState('')
  const [quality, setQuality]   = useState('best')
  const [format, setFormat]     = useState('video')
  const [info, setInfo]         = useState(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [jobId, setJobId]       = useState(null)
  const [job, setJob]           = useState(null)
  const [error, setError]       = useState('')
  const [done, setDone]         = useState(false)
  const pollRef                 = useRef(null)

  // Auto-fetch info when URL is pasted
  useEffect(() => {
    if (!url.trim() || !url.startsWith('http')) {
      setInfo(null); return
    }
    const t = setTimeout(async () => {
      setInfoLoading(true)
      setError('')
      try {
        const { data } = await axios.post(`${API}/info`, { url })
        setInfo(data)
      } catch {
        setInfo(null)
      } finally {
        setInfoLoading(false)
      }
    }, 800)
    return () => clearTimeout(t)
  }, [url])

  // Poll job status
  useEffect(() => {
    if (!jobId) return
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await axios.get(`${API}/status/${jobId}`)
        setJob(data)
        if (data.status === 'done') {
          clearInterval(pollRef.current)
          setDone(true)
        } else if (data.status === 'error') {
          clearInterval(pollRef.current)
          setError(data.error || 'Download failed')
        }
      } catch { clearInterval(pollRef.current) }
    }, 1000)
    return () => clearInterval(pollRef.current)
  }, [jobId])

  const handleDownload = async () => {
    if (!url.trim()) return
    setError(''); setDone(false); setJob(null)
    try {
      const { data } = await axios.post(`${API}/download`, { url, quality, format })
      setJobId(data.job_id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to start download')
    }
  }

  const handleSave = () => {
    window.open(`${API}/file/${jobId}`, '_blank')
  }

  const handleReset = async () => {
    if (jobId) {
      try { await axios.delete(`${API}/job/${jobId}`) } catch {}
    }
    setUrl(''); setInfo(null); setJobId(null); setJob(null)
    setDone(false); setError(''); setQuality('best'); setFormat('video')
  }

  const isDownloading = jobId && !done && job?.status !== 'error'
  const progress      = job?.progress || 0

  return (
    <div style={styles.root}>
      {/* Background glow orbs */}
      <div style={styles.orb1} />
      <div style={styles.orb2} />

      <div style={styles.container}>

        {/* ── Header ── */}
        <header style={styles.header}>
          <div style={styles.logoWrap}>
            <span style={styles.logoIcon}>📥</span>
            <span style={styles.logoText}>ClipDrop</span>
          </div>
          <p style={styles.tagline}>
            Download from anywhere. Keep what you love.
          </p>

          {/* Platform pills */}
          <div style={styles.pills}>
            {PLATFORMS.map(p => (
              <span key={p.name} style={styles.pill}>
                <span style={styles.pillIcon}>{p.icon}</span> {p.name}
              </span>
            ))}
          </div>
        </header>

        {/* ── Main Card ── */}
        <main style={styles.card}>

          {/* URL Input */}
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔗</span>
            <input
              style={styles.input}
              type="text"
              placeholder="Paste video URL here..."
              value={url}
              onChange={e => { setUrl(e.target.value); setJobId(null); setDone(false) }}
              disabled={isDownloading}
            />
            {url && (
              <button style={styles.clearBtn} onClick={handleReset}>✕</button>
            )}
          </div>

          {/* Video Info Preview */}
          {infoLoading && (
            <div style={styles.infoCard}>
              <div style={styles.shimmer} />
            </div>
          )}

          {info && !infoLoading && (
            <div style={styles.infoCard}>
              {info.thumbnail && (
                <img src={info.thumbnail} alt="" style={styles.thumb} />
              )}
              <div style={styles.infoText}>
                <p style={styles.infoTitle}>{info.title}</p>
                <p style={styles.infoMeta}>
                  <span style={{ color: 'var(--accent)' }}>◈ {info.platform}</span>
                  {info.uploader && <span> · {info.uploader}</span>}
                  {info.duration > 0 && <span> · {formatDuration(info.duration)}</span>}
                  {info.view_count > 0 && <span> · {formatViews(info.view_count)}</span>}
                  {info.is_playlist && (
                    <span style={{ color: 'var(--cyan)' }}> · {info.entries_count} videos</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Quality Selector */}
          <div style={styles.sectionLabel}>Quality</div>
          <div style={styles.qualityRow}>
            {QUALITIES.map(q => (
              <button
                key={q.value}
                style={{
                  ...styles.qualityBtn,
                  ...(quality === q.value ? styles.qualityBtnActive : {})
                }}
                onClick={() => setQuality(q.value)}
                disabled={isDownloading}
              >
                <span style={styles.qualityIcon}>{q.icon}</span>
                <span>{q.label}</span>
              </button>
            ))}
          </div>

          {/* Format Selector */}
          <div style={styles.sectionLabel}>Type</div>
          <div style={styles.formatRow}>
            {FORMATS.map(f => (
              <button
                key={f.value}
                style={{
                  ...styles.formatBtn,
                  ...(format === f.value ? styles.formatBtnActive : {})
                }}
                onClick={() => setFormat(f.value)}
                disabled={isDownloading}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={styles.errorBox}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Progress */}
          {isDownloading && (
            <div style={styles.progressWrap}>
              <div style={styles.progressHeader}>
                <span style={{ color: 'var(--cyan)', fontSize: 13 }}>
                  {job?.status === 'processing' ? '⚙ Processing...' : `⬇ Downloading...`}
                </span>
                <span style={styles.progressPct}>{Math.round(progress)}%</span>
              </div>
              <div style={styles.progressBg}>
                <div style={{ ...styles.progressBar, width: `${progress}%` }} />
              </div>
              {job?.speed && (
                <div style={styles.progressMeta}>
                  <span>🚀 {job.speed}</span>
                  {job.eta && <span>⏱ ETA: {job.eta}</span>}
                </div>
              )}
            </div>
          )}

          {/* Done State */}
          {done && (
            <div style={styles.doneBox}>
              <span style={styles.doneIcon}>✓</span>
              <span>Download complete!</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={styles.btnRow}>
            {!done ? (
              <button
                style={{
                  ...styles.dlBtn,
                  ...(isDownloading ? styles.dlBtnDisabled : {}),
                  ...(url && !isDownloading ? styles.dlBtnGlow : {}),
                }}
                onClick={handleDownload}
                disabled={isDownloading || !url.trim()}
              >
                {isDownloading
                  ? <><span style={styles.spinner} /> Processing...</>
                  : '⬇  Download Now'}
              </button>
            ) : (
              <>
                <button style={styles.saveBtn} onClick={handleSave}>
                  💾  Save File
                </button>
                <button style={styles.resetBtn} onClick={handleReset}>
                  ↺  New Download
                </button>
              </>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer style={styles.footer}>
          <span style={{ color: 'var(--muted)' }}>
            Powered by Md Shagaf Raiyan Rashid
          </span>
        </footer>

      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  root: {
    minHeight: '100vh',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    zIndex: 1,
  },
  orb1: {
    position: 'fixed', top: '-10%', left: '-10%',
    width: 500, height: 500, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(255,59,107,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  orb2: {
    position: 'fixed', bottom: '-10%', right: '-10%',
    width: 600, height: 600, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123,47,255,0.10) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  container: {
    width: '100%', maxWidth: 680,
    display: 'flex', flexDirection: 'column', gap: 24,
    animation: 'fadeUp 0.6s ease both',
    position: 'relative', zIndex: 2,
  },
  header: {
    textAlign: 'center',
  },
  logoWrap: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, marginBottom: 8,
  },
  logoIcon: { fontSize: 36 },
  logoText: {
    fontSize: 42, fontWeight: 800,
    fontFamily: 'var(--font-display)',
    background: 'linear-gradient(135deg, #ff3b6b 0%, #7b2fff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    letterSpacing: '-1px',
  },
  tagline: {
    color: 'var(--muted)', fontSize: 15,
    fontFamily: 'var(--font-mono)', marginBottom: 16,
  },
  pills: {
    display: 'flex', flexWrap: 'wrap',
    justifyContent: 'center', gap: 8,
  },
  pill: {
    padding: '4px 12px', borderRadius: 999,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    fontSize: 12, color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
  },
  pillIcon: { marginRight: 4 },
  card: {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '28px 28px',
    display: 'flex', flexDirection: 'column', gap: 16,
    boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
  },
  inputWrap: {
    display: 'flex', alignItems: 'center',
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 12, overflow: 'hidden',
    transition: 'border-color 0.2s',
  },
  inputIcon: { padding: '0 12px', fontSize: 18 },
  input: {
    flex: 1, background: 'transparent',
    border: 'none', outline: 'none',
    color: 'var(--text)', fontSize: 15,
    fontFamily: 'var(--font-mono)',
    padding: '14px 0',
  },
  clearBtn: {
    padding: '0 14px', background: 'transparent',
    border: 'none', color: 'var(--muted)',
    cursor: 'pointer', fontSize: 16,
  },
  infoCard: {
    display: 'flex', gap: 12, alignItems: 'flex-start',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12, padding: 12, overflow: 'hidden',
  },
  thumb: {
    width: 100, height: 60, objectFit: 'cover',
    borderRadius: 8, flexShrink: 0,
  },
  infoText: { flex: 1, minWidth: 0 },
  infoTitle: {
    fontSize: 14, fontWeight: 600,
    color: 'var(--text)', marginBottom: 6,
    overflow: 'hidden', textOverflow: 'ellipsis',
    display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  infoMeta: {
    fontSize: 12, color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
    display: 'flex', flexWrap: 'wrap', gap: '0 8px',
  },
  shimmer: {
    height: 60, borderRadius: 8, width: '100%',
    background: 'linear-gradient(90deg, var(--surface) 25%, var(--border) 50%, var(--surface) 75%)',
    backgroundSize: '200% 100%',
    animation: 'progress-shine 1.5s infinite',
  },
  sectionLabel: {
    fontSize: 11, fontWeight: 700,
    letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--muted)', fontFamily: 'var(--font-mono)',
  },
  qualityRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  qualityBtn: {
    flex: 1, minWidth: 60,
    padding: '10px 4px',
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--muted)',
    cursor: 'pointer', fontSize: 13, fontWeight: 600,
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 4,
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  qualityBtnActive: {
    border: '1.5px solid var(--accent)',
    color: 'var(--accent)',
    background: 'rgba(255,59,107,0.08)',
  },
  qualityIcon: { fontSize: 16 },
  formatRow: { display: 'flex', gap: 8 },
  formatBtn: {
    flex: 1, padding: '10px 0',
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 10, color: 'var(--muted)',
    cursor: 'pointer', fontSize: 14, fontWeight: 600,
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
  },
  formatBtnActive: {
    border: '1.5px solid var(--accent2)',
    color: 'var(--accent2)',
    background: 'rgba(123,47,255,0.08)',
  },
  errorBox: {
    background: 'rgba(255,59,107,0.08)',
    border: '1px solid rgba(255,59,107,0.3)',
    borderRadius: 10, padding: '12px 16px',
    color: 'var(--accent)', fontSize: 13,
    fontFamily: 'var(--font-mono)',
    display: 'flex', gap: 8, alignItems: 'flex-start',
  },
  progressWrap: {
    display: 'flex', flexDirection: 'column', gap: 8,
  },
  progressHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  progressPct: {
    fontFamily: 'var(--font-mono)', fontSize: 13,
    color: 'var(--cyan)',
  },
  progressBg: {
    height: 6, background: 'var(--surface)',
    borderRadius: 999, overflow: 'hidden',
  },
  progressBar: {
    height: '100%', borderRadius: 999,
    background: 'linear-gradient(90deg, var(--accent) 0%, var(--accent2) 100%)',
    transition: 'width 0.4s ease',
    backgroundSize: '200% 100%',
    animation: 'progress-shine 2s infinite',
  },
  progressMeta: {
    display: 'flex', justifyContent: 'space-between',
    fontSize: 12, color: 'var(--muted)',
    fontFamily: 'var(--font-mono)',
  },
  doneBox: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'rgba(0,229,122,0.08)',
    border: '1px solid rgba(0,229,122,0.3)',
    borderRadius: 10, padding: '12px 16px',
    color: 'var(--green)', fontSize: 15, fontWeight: 600,
  },
  doneIcon: {
    width: 24, height: 24, borderRadius: '50%',
    background: 'var(--green)', color: '#000',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 13, fontWeight: 800,
    flexShrink: 0,
  },
  btnRow: { display: 'flex', gap: 10 },
  dlBtn: {
    flex: 1, padding: '16px 0',
    background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
    border: 'none', borderRadius: 12,
    color: '#fff', fontSize: 16, fontWeight: 700,
    cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: 8,
    transition: 'all 0.2s',
    fontFamily: 'var(--font-display)',
    letterSpacing: '0.02em',
  },
  dlBtnGlow: { animation: 'pulse-glow 2.5s ease-in-out infinite' },
  dlBtnDisabled: { opacity: 0.6, cursor: 'not-allowed', animation: 'none' },
  saveBtn: {
    flex: 1, padding: '16px 0',
    background: 'linear-gradient(135deg, var(--green) 0%, #00b85e 100%)',
    border: 'none', borderRadius: 12,
    color: '#000', fontSize: 15, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'var(--font-display)',
  },
  resetBtn: {
    padding: '16px 20px',
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 12, color: 'var(--muted)',
    cursor: 'pointer', fontSize: 15,
    fontFamily: 'var(--font-display)',
  },
  spinner: {
    display: 'inline-block',
    width: 16, height: 16,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
  },
  footer: {
    textAlign: 'center', fontSize: 12,
    fontFamily: 'var(--font-mono)',
    paddingBottom: 8,
  },
}

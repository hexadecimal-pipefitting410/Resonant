import { Download, FolderInput, HardDrive, Library, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { formatBytes, type InstrumentDownloadProgress, type InstrumentLibraryState, type InstrumentSummary } from '../domain/instruments'

interface Props {
  library: InstrumentLibraryState
  close(): void
  refresh(): Promise<void>
  notify(message: string, tone?: 'info' | 'error' | 'success'): void
}

export function InstrumentLibraryModal({ library, close, refresh, notify }: Props) {
  const [query, setQuery] = useState('violin guitar flute tabla piano')
  const [catalog, setCatalog] = useState<InstrumentSummary[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState<InstrumentDownloadProgress | null>(null)
  const installedIds = useMemo(() => new Set(library.packs.filter((pack) => pack.id.startsWith('webaudiofont-')).map((pack) => pack.id.slice('webaudiofont-'.length))), [library.packs])

  useEffect(() => window.resonantDesktop?.onInstrumentProgress(setProgress), [])

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label); setProgress(null)
    try { await action(); await refresh(); notify(`${label} completed.`, 'success') }
    catch (error) { notify(error instanceof Error ? error.message : `${label} failed.`, 'error') }
    finally { setBusy(null); setProgress(null) }
  }
  const search = async () => {
    if (!window.resonantDesktop) return
    setBusy('Searching catalog')
    try { setCatalog(await window.resonantDesktop.searchInstrumentCatalog(query)) }
    catch (error) { notify(error instanceof Error ? error.message : 'Catalog search failed.', 'error') }
    finally { setBusy(null) }
  }

  return <div className="modal-backdrop instrument-backdrop" role="dialog" aria-modal="true" aria-label="Instrument library">
    <section className="instrument-library-modal">
      <header><div><span className="eyebrow">SHARED SAMPLE STORAGE</span><h2><Library size={20} /> Instrument library</h2><p>Downloaded once, available to every project and to MCP.</p></div><button className="modal-close" aria-label="Close instrument library" onClick={close}><X size={20} /></button></header>
      <div className="library-stats"><span><HardDrive size={14} /><strong>{formatBytes(library.bytes)}</strong> installed</span><span><strong>{library.instruments.length}</strong> playable instruments</span><code title={library.root}>{library.root}</code></div>
      <div className="library-actions">
        <button disabled={!!busy} onClick={() => void run('GeneralUser GS installation', () => window.resonantDesktop!.installGeneralUser())}><Download size={15} /><span><strong>Install GeneralUser GS</strong><small>260+ instruments and drum kits · about 31 MB</small></span></button>
        <button disabled={!!busy} onClick={() => void run('Instrument import', () => window.resonantDesktop!.importInstrument())}><FolderInput size={15} /><span><strong>Import your own instrument</strong><small>SF2, SF3, DLS, SFZ, WAV, OGG, MP3, FLAC</small></span></button>
      </div>
      {progress && <div className="download-progress"><span>{progress.label}</span><progress max={progress.total || 1} value={progress.received} /><output>{progress.total ? `${Math.round(progress.received / progress.total * 100)}%` : formatBytes(progress.received)}</output></div>}
      <div className="library-columns">
        <section><div className="library-section-head"><h3>INSTALLED</h3><span>{library.packs.length} packs</span></div><div className="instrument-scroll installed-list">
          {!library.packs.length && <div className="library-empty">Nothing installed yet. Start with GeneralUser GS or import an instrument file.</div>}
          {library.packs.map((pack) => <article key={pack.id}><div><strong>{pack.name}</strong><small>{pack.instrumentCount} instruments · {formatBytes(pack.bytes)} · {pack.format}</small></div><button title={`Remove ${pack.name}`} aria-label={`Remove ${pack.name}`} onClick={() => {
            if (window.confirm(`Remove ${pack.name} from the shared instrument library? Projects using it will fall back to their synthesizer.`)) void run('Pack removal', () => window.resonantDesktop!.removeInstrumentPack(pack.id))
          }}><Trash2 size={13} /></button></article>)}
        </div></section>
        <section><div className="library-section-head"><h3>WEBAUDIOFONT · 3,000+ PRESETS</h3></div><form className="catalog-search" onSubmit={(event) => { event.preventDefault(); void search() }}><input aria-label="Search WebAudioFont" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="violin, tabla, flute, guitar…" /><button disabled={!!busy}><Search size={14} /> SEARCH</button></form><div className="instrument-scroll catalog-list">
          {!catalog.length && <div className="library-empty">Search the online catalog. Each preset is cached in the shared library after installation.</div>}
          {catalog.map((instrument) => { const installed = installedIds.has(instrument.id.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)); return <article key={instrument.id}><div><strong>{instrument.instrument || instrument.name}</strong><small>{instrument.name} · {instrument.family} · {instrument.bank}</small></div><button disabled={!!busy || installed} onClick={() => void run(`${instrument.name} installation`, () => window.resonantDesktop!.installWebAudioFont(instrument))}>{installed ? 'INSTALLED' : 'INSTALL'}</button></article> })}
        </div></section>
      </div>
      <footer><span>Instrument data is not copied into .resonant project files.</span><button onClick={close}>DONE</button></footer>
    </section>
  </div>
}

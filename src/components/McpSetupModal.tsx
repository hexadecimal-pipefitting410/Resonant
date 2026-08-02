import { useEffect, useState } from 'react'
import { Bot, CheckCircle2, Clipboard, FolderOpen, Terminal, X } from 'lucide-react'
import type { McpSetupInfo } from '../env'

type Client = 'codex' | 'claude' | 'generic' | 'terminal'

export function McpSetupModal({ close, notify }: { close: () => void; notify: (message: string, tone?: 'info' | 'error' | 'success') => void }) {
  const [setup, setSetup] = useState<McpSetupInfo | null>(null)
  const [client, setClient] = useState<Client>('codex')

  useEffect(() => {
    window.resonantDesktop?.getMcpSetup().then(setSetup).catch((error) => notify(error instanceof Error ? error.message : 'MCP setup could not be loaded.', 'error'))
  }, [notify])

  const snippet = setup ? client === 'terminal' ? setup.powershell : setup[client] : ''
  const copy = async () => {
    if (!snippet) return
    try { await window.resonantDesktop?.copyText(snippet); notify(`${client === 'terminal' ? 'PowerShell command' : `${client} configuration`} copied.`, 'success') }
    catch { notify('The configuration could not be copied.', 'error') }
  }
  const chooseRoot = async () => {
    try { const result = await window.resonantDesktop?.chooseMcpRoot(); if (result?.setup) setSetup(result.setup) }
    catch { notify('The music workspace could not be selected.', 'error') }
  }

  return <div className="modal-backdrop mcp-backdrop" role="dialog" aria-modal="true" aria-labelledby="mcp-setup-title">
    <section className="mcp-setup-modal">
      <header>
        <div className="mcp-orbit"><Bot size={25} /></div>
        <div><span className="eyebrow">LOCAL AGENT CONTROL</span><h2 id="mcp-setup-title">Connect your AI producer</h2><p>Let Codex, Claude Code, or any STDIO MCP client write, arrange, mix, analyze, and render saved Resonant projects.</p></div>
        <button className="modal-close" aria-label="Close MCP setup" onClick={close}><X size={19} /></button>
      </header>
      <div className="mcp-status"><span className={setup?.bundled ? 'ready' : ''}>{setup?.bundled ? <CheckCircle2 size={14} /> : <Terminal size={14} />}<strong>{setup?.bundled ? 'MCP RUNTIME READY' : 'BUILD MCP RUNTIME'}</strong></span><small>{setup?.packaged ? 'Included with this installation—no separate Node.js required.' : setup?.bundled ? 'Development runtime is built and ready for a local client.' : 'Development build: run npm run build:mcp before connecting.'}</small></div>
      <div className="mcp-body">
        <aside>
          <span className="eyebrow">CHOOSE YOUR CLIENT</span>
          {([['codex', 'Codex', 'config.toml'], ['claude', 'Claude Code', '.mcp.json'], ['generic', 'Any MCP client', 'STDIO JSON'], ['terminal', 'PowerShell', 'Manual launch']] as const).map(([id, label, detail]) => <button key={id} className={client === id ? 'active' : ''} onClick={() => setClient(id)}><Bot size={16} /><span><strong>{label}</strong><small>{detail}</small></span></button>)}
          <div className="mcp-privacy"><strong>LOCAL BY DEFAULT</strong><span>The assistant receives structured project information—not microphone input or raw audio payloads.</span></div>
        </aside>
        <main>
          <div className="mcp-root"><span><FolderOpen size={15} /><label>MUSIC WORKSPACE</label><code>{setup?.workspaceRoot || 'Loading…'}</code></span><button onClick={() => void chooseRoot()}>CHOOSE FOLDER</button></div>
          <div className="mcp-instructions"><strong>{client === 'codex' ? 'Add to Codex config.toml' : client === 'claude' ? 'Add to your Claude .mcp.json' : client === 'generic' ? 'Use this STDIO server definition' : 'Launch the bundled server manually'}</strong><span>Restart the assistant after adding the configuration, then ask it to call <code>get_capabilities</code>.</span></div>
          <pre aria-label={`${client} MCP configuration`}><code>{snippet || 'Preparing the installed MCP path…'}</code></pre>
          <button className="mcp-copy" disabled={!setup?.bundled} onClick={() => void copy()}><Clipboard size={15} /> COPY CONFIGURATION</button>
          <div className="mcp-prompt"><span>TRY THIS FIRST</span><p>“Use Resonant to create an original 32-bar track, validate and analyze the mix, then render a WAV in my music workspace.”</p></div>
        </main>
      </div>
      <footer><span>Project writes are revision-checked and confined to the selected workspace.</span><button onClick={close}>DONE</button></footer>
    </section>
  </div>
}

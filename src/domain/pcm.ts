export function floatsToBase64(channels: Float32Array[]): string {
  const frames = channels[0]?.length ?? 0
  const bytes = new Uint8Array(frames * channels.length * 4)
  const view = new DataView(bytes.buffer)
  let offset = 0
  for (let frame = 0; frame < frames; frame++) for (const channel of channels) { view.setFloat32(offset, channel[frame] ?? 0, true); offset += 4 }
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(binary)
}

export function base64ToFloats(base64: string, channelCount: number, frames: number): Float32Array[] {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  const view = new DataView(bytes.buffer)
  const channels = Array.from({ length: channelCount }, () => new Float32Array(frames))
  let offset = 0
  for (let frame = 0; frame < frames; frame++) for (let channel = 0; channel < channelCount; channel++) {
    if (offset + 4 <= bytes.length) channels[channel][frame] = view.getFloat32(offset, true)
    offset += 4
  }
  return channels
}

export function summarizeWaveform(channels: Float32Array[], bins = 72): number[] {
  const frames = channels[0]?.length ?? 0
  if (!frames || !channels.length || bins < 1) return []
  return Array.from({ length: bins }, (_, bin) => {
    const start = Math.floor(bin * frames / bins)
    const end = Math.max(start + 1, Math.floor((bin + 1) * frames / bins))
    const stride = Math.max(1, Math.floor((end - start) / 1000))
    let peak = 0
    for (let frame = start; frame < end; frame += stride) for (const channel of channels) peak = Math.max(peak, Math.abs(channel[frame] ?? 0))
    return Math.min(1, peak)
  })
}

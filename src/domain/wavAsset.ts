export function encodePcm16Wav(channels: readonly Float32Array[], sampleRate: number) {
  if (channels.length < 1 || channels.length > 2 || !channels[0]?.length) throw new Error('Shared audio requires one or two non-empty channels.')
  if (!Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) throw new Error('Shared audio sample rate is invalid.')
  const frames = channels[0].length
  if (channels.some((channel) => channel.length !== frames)) throw new Error('Shared audio channels must have equal length.')
  const output = new Uint8Array(44 + frames * channels.length * 2)
  const view = new DataView(output.buffer)
  const text = (offset: number, value: string) => { for (let index = 0; index < value.length; index++) view.setUint8(offset + index, value.charCodeAt(index)) }
  text(0, 'RIFF'); view.setUint32(4, output.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ')
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels.length, true); view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * channels.length * 2, true); view.setUint16(32, channels.length * 2, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, frames * channels.length * 2, true)
  let offset = 44
  for (let frame = 0; frame < frames; frame++) for (const channel of channels) {
    const sample = Math.max(-1, Math.min(1, Number.isFinite(channel[frame]) ? channel[frame] : 0))
    view.setInt16(offset, sample < 0 ? Math.round(sample * 32768) : Math.round(sample * 32767), true); offset += 2
  }
  return output
}

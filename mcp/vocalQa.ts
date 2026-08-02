import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import { aceStepRoot } from './aceStep'
import { decodeWav } from './music'

const TRANSCRIBE = String.raw`
import json, os, sys
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
from transformers import WhisperForConditionalGeneration, WhisperProcessor, logging
import math, numpy as np, soundfile as sf, torch
from scipy.signal import resample_poly
logging.set_verbosity_error()
audio_path, model_id = sys.argv[1], sys.argv[2]
wave, rate = sf.read(audio_path, dtype="float32", always_2d=True)
wave = wave.mean(axis=1)
if rate != 16000:
    divisor = math.gcd(rate, 16000)
    wave = resample_poly(wave, 16000 // divisor, rate // divisor).astype(np.float32)
processor = WhisperProcessor.from_pretrained(model_id)
model = WhisperForConditionalGeneration.from_pretrained(model_id, torch_dtype=torch.float32).to("cpu")
chunks, window, step = [], 30 * 16000, 28 * 16000
with torch.inference_mode():
    for start in range(0, len(wave), step):
        segment = wave[start:min(len(wave), start + window)]
        if len(segment) < 1600:
            continue
        features = processor(segment, sampling_rate=16000, return_tensors="pt").input_features
        predicted = model.generate(features)
        text = processor.batch_decode(predicted, skip_special_tokens=True)[0].strip()
        if text:
            chunks.append({"text": text, "timestamp": [start / 16000, min(len(wave), start + window) / 16000]})
value = {"text": " ".join(chunk["text"] for chunk in chunks), "chunks": chunks}
print("RESONANT_QA=" + json.dumps(value, ensure_ascii=False))
`

export function lyricWords(value: string) {
  return value.normalize('NFC').replace(/^\s*\[[^\]]+]\s*$/gm, ' ').replace(/\([^)]*\)/g, ' ').toLowerCase().match(/[\p{L}\p{M}\p{N}']+/gu) ?? []
}

function distance(left: string[], right: string[]) {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let row = 1; row <= left.length; row++) {
    const current = [row]
    for (let column = 1; column <= right.length; column++) current[column] = Math.min(current[column - 1] + 1, previous[column] + 1, previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1))
    previous = current
  }
  return previous[right.length]
}

export function compareVocalLyrics(lyrics: string, transcript: string) {
  const target = lyricWords(lyrics), heard = lyricWords(transcript)
  const edits = distance(target, heard)
  const wordErrorRate = target.length ? edits / target.length : 1
  const targetCounts = new Map<string, number>(), heardCounts = new Map<string, number>()
  target.forEach((word) => targetCounts.set(word, (targetCounts.get(word) ?? 0) + 1)); heard.forEach((word) => heardCounts.set(word, (heardCounts.get(word) ?? 0) + 1))
  const missing = [...targetCounts.entries()].map(([word, count]) => ({ word, missing: Math.max(0, count - (heardCounts.get(word) ?? 0)) })).filter((item) => item.missing > 0 && item.word.length > 3).sort((a, b) => b.missing - a.missing || b.word.length - a.word.length).slice(0, 20)
  const coverage = Math.max(0, Math.min(1, 1 - wordErrorRate))
  return { targetWords: target.length, transcribedWords: heard.length, editDistance: edits, wordErrorRate: Number(wordErrorRate.toFixed(3)), estimatedCoverage: Number(coverage.toFixed(3)), missingOrUnclearWords: missing }
}

function run(executable: string, args: string[], environment: NodeJS.ProcessEnv) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, { env: environment, windowsHide: true })
    let stdout = '', stderr = ''
    child.stdout.on('data', (chunk) => { stdout += chunk.toString() }); child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
    child.once('error', reject); child.once('exit', (code) => code === 0 ? resolve(stdout) : reject(new Error((stderr || stdout || `Vocal QA exited with ${code}`).slice(-4000))))
  })
}

export async function transcribeSinging(wavPath: string, model: 'tiny.en' | 'base.en' = 'base.en') {
  const python = path.join(aceStepRoot(), 'runtime', '.venv', 'Scripts', 'python.exe')
  try { await access(python) } catch { throw new Error('Local vocal transcription requires the optional ACE-Step Python runtime.') }
  const output = await run(python, ['-c', TRANSCRIBE, wavPath, `openai/whisper-${model}`], { ...process.env, HF_HOME: path.join(aceStepRoot(), 'cache', 'huggingface'), HF_HUB_DISABLE_XET: '1' })
  const marker = output.trim().split(/\r?\n/).reverse().find((line: string) => line.startsWith('RESONANT_QA='))
  if (!marker) throw new Error('The local transcription model returned no readable result.')
  return JSON.parse(marker.slice('RESONANT_QA='.length)) as { text?: string; chunks?: Array<{ text: string; timestamp?: [number, number] }> }
}

export function technicalVocalReadiness(bytes: Uint8Array, lyrics: string) {
  const decoded = decodeWav(bytes), mono = new Float32Array(decoded.frames)
  for (let frame = 0; frame < decoded.frames; frame++) mono[frame] = decoded.channels.reduce((sum, channel) => sum + channel[frame], 0) / decoded.channels.length
  const windowFrames = Math.max(1, Math.floor(decoded.sampleRate * 0.05)), threshold = 0.012
  let first = 0, last = mono.length - 1
  const windowRms = (start: number) => { let square = 0, count = 0; for (let index = start; index < Math.min(mono.length, start + windowFrames); index++) { square += mono[index] * mono[index]; count++ } return Math.sqrt(square / Math.max(1, count)) }
  while (first < mono.length && windowRms(first) < threshold) first += windowFrames
  while (last > 0 && windowRms(Math.max(0, last - windowFrames)) < threshold) last -= windowFrames
  const durationSeconds = decoded.frames / decoded.sampleRate, targetWords = lyricWords(lyrics).length
  const wordsPerMinute = durationSeconds ? targetWords / durationSeconds * 60 : 0
  const warnings: string[] = []
  if (wordsPerMinute > 175) warnings.push('The lyric is dense for the available duration; pronunciation may feel rushed.')
  if (wordsPerMinute < 35 && targetWords > 20) warnings.push('The lyric is sparse for the available duration; the model may add long instrumental passages or repeat sections.')
  return { durationSeconds: Number(durationSeconds.toFixed(2)), sampleRate: decoded.sampleRate, channels: decoded.channels.length, targetWords, plannedWordsPerMinute: Number(wordsPerMinute.toFixed(1)), leadingLowEnergySeconds: Number((first / decoded.sampleRate).toFixed(2)), trailingLowEnergySeconds: Number(((mono.length - 1 - last) / decoded.sampleRate).toFixed(2)), warnings }
}

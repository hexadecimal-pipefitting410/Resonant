import { readFile, writeFile } from 'node:fs/promises'
import pngToIco from 'png-to-ico'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'

let png = await readFile(new URL('../build/icon.png', import.meta.url))
if (png[0] === 0xff && png[1] === 0xd8) {
  const decoded = jpeg.decode(png, { useTArray: true })
  png = PNG.sync.write({ width: decoded.width, height: decoded.height, data: decoded.data })
  await writeFile(new URL('../build/icon.png', import.meta.url), png)
}
const ico = await pngToIco(png)
await writeFile(new URL('../build/icon.ico', import.meta.url), ico)
console.log(`Generated build/icon.ico (${ico.byteLength} bytes)`)

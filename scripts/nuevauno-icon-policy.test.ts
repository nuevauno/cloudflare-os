import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const userInterfaces = path.join(root, 'packages')

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(target)
    return /\.tsx?$/.test(entry.name) ? [target] : []
  }))
  return nested.flat()
}

test('todas las interfaces visibles usan exclusivamente iconos NUEVAUNO', async () => {
  const violations: string[] = []
  for (const file of await sourceFiles(userInterfaces)) {
    const source = await readFile(file, 'utf8')
    if (source.includes('@phosphor-icons/react')) {
      violations.push(path.relative(root, file))
    }
  }
  assert.deepEqual(violations, [], `Iconos heredados encontrados en:\n${violations.join('\n')}`)
})

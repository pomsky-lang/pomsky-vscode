import { asyncSpawn, Spawned } from './utils/asyncSpawn'
import * as os from 'node:os'
import * as path from 'node:path'

export interface PomskyJsonResponse {
  version: '1'
  success: boolean
  output?: string
  diagnostics: PomskyJsonDiagnostic[]
  timings: { all: number }
}

export interface PomskyJsonDiagnostic {
  severity: 'error' | 'warning'
  kind: string
  code: string
  spans: { start: number; end: number }[]
  description: string
  help: string[]
  fixes: never[]
  visual: string
}

const previous = new Map<string, Spawned>()

// hard-code ~/.cargo/bin, as directories such as /usr/bin are included automatically
const PATH = path.resolve(os.homedir(), '.cargo/bin')

export async function runPomsky(
  flavor: 'js',
  content: string,
  key: string,
): Promise<PomskyJsonResponse> {
  const prevProcess = previous.get(key)
  if (prevProcess !== undefined) {
    prevProcess.kill()
    previous.delete(key)
  }

  const process = asyncSpawn('pomsky', ['-f', flavor, '--json', content], {
    expectedCodes: [0, 1],
    timeout: 30_000,
    env: { PATH },
  })
  previous.set(key, process)

  const { stdout } = await process.promise
  previous.delete(key)

  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(`Pomsky returned invalid JSON: ${stdout}`)
  }
}

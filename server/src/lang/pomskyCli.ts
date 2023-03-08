import * as os from 'node:os'
import * as path from 'node:path'
import { Config } from '../types/config'
import { PomskyJsonResponse } from '../types/pomskyCli'
import { asyncSpawn, Spawned } from '../util/asyncSpawn'

const previous = new Map<string, Spawned>()

// hard-code ~/.cargo/bin, as directories such as /usr/bin are included automatically
const PATH = path.resolve(os.homedir(), '.cargo/bin')

export async function runPomsky(
  { defaultFlavor, executable }: Config,
  content: string,
  key: string,
): Promise<PomskyJsonResponse> {
  const prevProcess = previous.get(key)
  if (prevProcess !== undefined) {
    prevProcess.kill()
    previous.delete(key)
  }

  const process = asyncSpawn(
    executable.path === '' ? 'pomsky' : executable.path,
    ['-f', defaultFlavor, '--json', content, ...parseExtraArgs(executable.extraArgs)],
    {
      expectedCodes: [0, 1],
      timeout: 30_000,
      env: { PATH },
    },
  )
  previous.set(key, process)

  const { stdout } = await process.promise
  previous.delete(key)

  try {
    return JSON.parse(stdout)
  } catch {
    throw new Error(`Pomsky returned invalid JSON: ${stdout}`)
  }
}

export async function pomskyVersion({ executable }: Config): Promise<string> {
  const process = asyncSpawn(executable.path || 'pomsky', ['--version'], {
    timeout: 2_000,
    env: { PATH },
  })

  const { stdout } = await process.promise
  return stdout.trim()
}

function parseExtraArgs(args?: string): string[] {
  if (args == null) {
    return []
  }

  return args
    .split(/(?<=(?<!\\)(\\\\)*) /)
    .map(s => s.replace(/\\(.)/g, '$1'))
    .filter(s => s !== '')
}

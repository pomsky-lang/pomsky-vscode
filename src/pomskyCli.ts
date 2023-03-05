import * as cp from 'node:child_process'
import type { ChildProcessWithoutNullStreams } from 'node:child_process'

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

let ps: ChildProcessWithoutNullStreams | undefined
const previousContent = new Map<string, string>()

export async function runPomsky(
  flavor: 'js',
  content: string,
  key: string,
): Promise<PomskyJsonResponse | undefined> {
  if (content === previousContent.get(key)) {
    return
  }
  previousContent.set(key, content)

  let promiseCompleted = false

  return new Promise((resolve, reject) => {
    if (ps !== undefined) {
      ps.kill()
      ps = undefined
    }

    try {
      ps = cp.spawn('pomsky', ['-f', flavor, '--json', content])
    } catch (e) {
      ps = undefined
      promiseCompleted = true
      return reject(e)
    }

    const currentPs = ps

    let allOut = ''
    let allErr = ''
    ps.stdout.on('data', data => (allOut += data))
    ps.stderr.on('data', data => (allErr += data))

    ps.on('error', e => {
      if (promiseCompleted) {
        return
      }
      ps = undefined
      promiseCompleted = true

      if (e.message.includes('ENOENT')) {
        reject(
          new Error('Pomsky executable not found. Make sure the `pomsky` binary is in your PATH'),
        )
      } else {
        reject(e)
      }
    })

    ps.on('close', (code: number) => {
      if (promiseCompleted) {
        return
      }
      ps = undefined
      promiseCompleted = true

      if (code == null && currentPs.killed) {
        resolve(undefined)
      } else if (code !== 0 && code !== 1) {
        reject(
          new Error(
            `Pomsky exited with non-zero status code: ${code}\n\nSTDOUT: ${allOut}\nSTDERR: ${allErr}`,
          ),
        )
      } else {
        try {
          resolve(JSON.parse(allOut))
        } catch {
          reject(new Error(`Pomsky returned invalid JSON: ${allOut}`))
        }
      }
    })

    setTimeout(() => {
      if (promiseCompleted) {
        return
      }
      currentPs.kill()
      ps = undefined
      promiseCompleted = true
      reject(new Error(`Pomsky timed out after 30 seconds`))
    }, 30_000)
  })
}

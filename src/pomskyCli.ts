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

export async function runPomsky(flavor: 'js', content: string): Promise<PomskyJsonResponse> {
  return new Promise((resolve, reject) => {
    let ps: ChildProcessWithoutNullStreams
    try {
      ps = cp.spawn('pomsky', ['-f', flavor, '--json', content])
    } catch (e) {
      return reject(e)
    }

    let allOut = ''
    let allErr = ''
    ps.stdout.on('data', data => (allOut += data))
    ps.stderr.on('data', data => (allErr += data))
    ps.on('error', e => {
      if (e.message.includes('ENOENT')) {
        reject(
          new Error('Pomsky executable not found. Make sure the `pomsky` binary is in your PATH'),
        )
      } else {
        reject(e)
      }
    })
    ps.on('close', (code: number) => {
      if (code !== 0 && code !== 1) {
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
  })
}

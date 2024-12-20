import { ChildProcessWithoutNullStreams } from 'child_process'
import * as cp from 'node:child_process'

export interface Spawned {
  process?: ChildProcessWithoutNullStreams
  promise: Promise<{ stdout: string; stderr: string; code: number }>
  kill(): void
}

export interface AsyncSpawnArgs {
  stdin?: string
  expectedCodes?: number[]
  timeout?: number
  env?: NodeJS.ProcessEnv
}

export function asyncSpawn(
  command: string,
  args: string[],
  { expectedCodes = [0], timeout, env, stdin }: AsyncSpawnArgs = {},
): Spawned {
  let promiseCompleted = false
  let process: ChildProcessWithoutNullStreams

  try {
    process = cp.spawn(command, args, { env })
    if (stdin) {
      process.stdin.write(stdin)
      process.stdin.end()
    }
  } catch (e) {
    return {
      promise: Promise.reject(new Error(`could not spawn process '${command}'`)),
      kill: () => void 0,
    }
  }

  return {
    process,
    kill() {
      if (!promiseCompleted && !process.killed) {
        promiseCompleted = true
        process.kill()
      }
    },
    promise: new Promise((resolve, reject) => {
      let allOut = ''
      let allErr = ''
      process.stdout.on('data', data => (allOut += data))
      process.stderr.on('data', data => (allErr += data))

      process.on('error', e => {
        if (promiseCompleted) return
        promiseCompleted = true

        if (e.message.includes('ENOENT')) {
          reject(new NoExeError(command))
        } else if (e.message.includes('EACCES')) {
          reject(new NoAccessError(command))
        } else {
          reject(e)
        }
      })

      process.on('close', (code: number | null) => {
        if (promiseCompleted) return
        promiseCompleted = true

        if (code == null) {
          if (process.killed) {
            reject(new Error(`process '${command}' was killed unexpectedly`))
          } else {
            reject(new Error(`process '${command}' didn't exit properly`))
          }
        } else if (!expectedCodes.includes(code)) {
          const message =
            `process '${command}' exited with unexpected status code: ${code}\n\n` +
            `STDOUT: ${allOut}\nSTDERR: ${allErr}`
          reject(new Error(message))
        } else {
          resolve({ stdout: allOut, stderr: allErr, code })
        }
      })

      if (timeout) {
        setTimeout(() => {
          if (promiseCompleted || process.killed) return
          promiseCompleted = true

          process.kill()
          reject(new Error(`process '${command}' timed out after ${timeout / 1000} seconds`))
        }, timeout)
      }
    }),
  }
}

export class NoExeError extends Error {
  constructor(public readonly command: string) {
    super(`executable '${command}' not found. Make sure it's in your PATH!`)
  }
}

export class NoAccessError extends Error {
  constructor(public readonly command: string) {
    super(`no permission to execute '${command}'. Make sure the file is executable!`)
  }
}

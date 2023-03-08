import * as os from 'node:os'
import * as path from 'node:path'
import { Connection, MessageType, ShowMessageNotification } from 'vscode-languageserver'
import { getDocumentSettings, invalidExeReported } from '../config'
import { Config } from '../types/config'
import { PomskyJsonResponse } from '../types/pomskyCli'
import { asyncSpawn, NoExeError, Spawned } from '../util/asyncSpawn'

const previous = new Map<string, Spawned>()

// hard-code ~/.cargo/bin, as directories such as /usr/bin are included automatically
const PATH = path.resolve(os.homedir(), '.cargo/bin')

/**
 * Runs the pomsky CLI with the contents of the provided document and the applicable settings.
 * If there's an error, the error is reported and `undefined` is returned.
 */
export async function runPomskyWithErrorHandler(
  connection: Connection,
  document: { uri: string; getText(): string },
  settings?: Config,
): Promise<PomskyJsonResponse | void> {
  if (settings === undefined) {
    settings = await getDocumentSettings(document.uri)
  }

  if (!settings.executable.appearsValid) {
    if (!invalidExeReported.has(document.uri)) {
      invalidExeReported.set(document.uri, true)

      const { path, errorMsg } = settings.executable
      connection.sendNotification(ShowMessageNotification.type, {
        message: `Could not provide diagnostics: \`${path}\` appears to be invalid or not executable
        ${errorMsg ? ` — cause: ${errorMsg}` : ''} — source: \`pomsky.executable.path\` setting`,
        type: MessageType.Error,
      })
    }
    return
  }

  const text = document.getText()

  try {
    const res = await runPomsky(settings, text, document.uri)
    invalidExeReported.clear()
    return res
  } catch (e: unknown) {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })

    if (e instanceof Error) {
      await handleCliError(e, connection, document.uri)
    }
  }
}

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

async function handleCliError(e: Error, connection: Connection, uri: string) {
  if (e instanceof NoExeError) {
    // only report this error once
    if (invalidExeReported.has(uri)) {
      return
    }
    invalidExeReported.set(uri, true)

    connection.sendNotification(ShowMessageNotification.type, {
      message: `Couldn't find the '${e.command}' executable!
If you downloaded it from GitHub, make sure to set its path in the settings!`,
      type: MessageType.Error,
    })
  } else {
    connection.sendNotification(ShowMessageNotification.type, {
      message: `Error executing pomsky: ${e.message}`,
      type: MessageType.Error,
    })
  }
}

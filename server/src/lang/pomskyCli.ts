import * as os from 'node:os'
import * as path from 'node:path'
import { Connection, MessageType, ShowMessageNotification } from 'vscode-languageserver'
import { getDocumentSettings, invalidExeReported } from '../config'
import { Config } from '../types/config'
import { PomskyJsonResponse } from '../types/pomskyCli'
import { asyncSpawn, NoAccessError, NoExeError, Spawned } from '../util/asyncSpawn'

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
  { defaultFlavor, executable, runTests }: Config,
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
    [
      '-f',
      defaultFlavor,
      '--json',
      ...(runTests ? ['--test=pcre2'] : []),
      content,
      ...parseExtraArgs(executable.extraArgs),
    ],
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

export function cancelPomsky(key: string) {
  const prevProcess = previous.get(key)
  if (prevProcess !== undefined) {
    prevProcess.kill()
    previous.delete(key)
  }
}

export async function pomskyVersion(
  { executable }: Config,
  connection: Connection,
  key: string,
): Promise<string> {
  try {
    const process = asyncSpawn(executable.path || 'pomsky', ['--version'], {
      timeout: 2_000,
      env: { PATH },
    })

    const { stdout } = await process.promise
    return stdout.trim()
  } catch (e: unknown) {
    if (e instanceof Error) {
      await handleCliError(e, connection, key)
    }
    throw e
  }
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

async function handleCliError(e: Error, connection: Connection, key: string) {
  if (e instanceof NoExeError || e instanceof NoAccessError) {
    // only report these errors once
    if (invalidExeReported.has(key)) {
      return
    }
    invalidExeReported.set(key, true)

    connection.sendNotification(ShowMessageNotification.type, {
      message:
        e instanceof NoExeError
          ? `Couldn't find the '${e.command}' executable!
If you downloaded it from GitHub, make sure to set its path in the settings!`
          : e.message,
      type: MessageType.Error,
    })
  } else {
    connection.sendNotification(ShowMessageNotification.type, {
      message: `Error executing pomsky: ${e.message}`,
      type: MessageType.Error,
    })
  }
}

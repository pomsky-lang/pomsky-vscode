import { TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as fs from 'node:fs'
import * as os from 'node:os'

import { capabilities, connection } from './state'
import { Config } from './types/config'

// Cache the settings of all open documents
export const documentSettings: Map<string, Promise<Config>> = new Map()
export const invalidExeReported: Map<string, boolean> = new Map()

// The global settings, used when the `workspace/configuration` request is not supported by the client
const defaultSettings: Config = {
  defaultFlavor: 'JavaScript',
  executable: {
    path: 'pomsky',
    extraArgs: '',
  },
}
let globalSettings: Config = defaultSettings

const validatedPaths = new Map<string, string>()

export function initConfig(
  documents: TextDocuments<TextDocument>,
  onValidate: (document: TextDocument) => void,
) {
  connection.onDidChangeConfiguration(change => {
    invalidExeReported.clear()
    if (capabilities.config) {
      documentSettings.clear()
      validatedPaths.clear()
    } else {
      globalSettings = (change.settings.pomsky as Config) ?? defaultSettings
    }

    documents.all().forEach(onValidate)
  })
}

export async function getDocumentSettings(resource: string): Promise<Config> {
  if (!capabilities.config) {
    return globalSettings
  }

  let result = documentSettings.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({ scopeUri: resource, section: 'pomsky' })
    documentSettings.set(resource, result)
  }
  const config = await result

  try {
    const path = await getCachedFullPathOrThrow(config.executable.path)
    return {
      ...config,
      executable: {
        ...config.executable,
        path,
        appearsValid: true,
      },
    }
  } catch (e) {
    return {
      ...config,
      executable: {
        ...config.executable,
        appearsValid: false,
        errorMsg: (e as Error).message,
      },
    }
  }
}

/**
 * @throws {@link NodeJS.ErrnoException} or {@link Error}
 */
async function getCachedFullPathOrThrow(path: string): Promise<string> {
  const validatedPath = validatedPaths.get(path)

  if (validatedPath !== undefined) {
    return validatedPath
  }

  if (/[/\\]/.test(path)) {
    // a path, not just an executable name
    if (/^\.\.?[/\\]/.test(path)) {
      throw new Error('relative paths are not allowed')
    }
    let canonicalPath = path
    if (/^~[/\\]/.test(path)) {
      canonicalPath = path.replace('~', os.homedir())
    }

    await assertIsFile(canonicalPath)
    await assertCanExecute(canonicalPath)
    validatedPaths.set(path, canonicalPath)
    return canonicalPath
  } else {
    // may or may not be valid, making sure would probably be more effort
    validatedPaths.set(path, path)
    return path
  }
}

function assertCanExecute(path: string) {
  return new Promise<void>((resolve, reject) => {
    fs.access(path, fs.constants.X_OK, err => {
      if (err != null) reject(err)
      else resolve()
    })
  })
}

function assertIsFile(path: string) {
  return new Promise<void>((resolve, reject) => {
    fs.stat(path, (err, res) => {
      if (err != null) {
        reject(err)
      } else if (!res.isFile()) {
        reject(new Error(`can't execute \`${path}\` since it is not a file`))
      } else {
        resolve()
      }
    })
  })
}

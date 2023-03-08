import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  ShowMessageNotification,
  MessageType,
  TextDocuments,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'
import * as fs from 'node:fs'

import { getDocumentSettings } from '../config'
import { runPomsky } from './pomskyCli'
import { connection } from '../state'
import { NoExeError } from '../util/asyncSpawn'
import { Config } from '../types/config'
import { TextDecoder, TextEncoder } from 'node:util'

export function initDiagnostics(documents: TextDocuments<TextDocument>) {
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent(change => {
    validateTextDocument(change.document)
  })

  // Monitors file changes in VSCode
  // connection.onDidChangeWatchedFiles(_change => {
  //   connection.console.log('We received an file change event')
  // })
}

const noExeReported = new Map<string, boolean>()

export async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri)

  const text = textDocument.getText()

  try {
    const res = await runPomsky(settings, text, textDocument.uri)

    const encoded = res.diagnostics.length ? new TextEncoder().encode(text) : undefined

    const diagnostics = res.diagnostics.map(pd => {
      const span = pd.spans[0]
      const sliceBefore = encoded!.slice(0, span.start)
      const sliceInner = encoded!.slice(span.start, span.end)

      // convert UTF-8 byte offsets to UTF-16 code unit offsets
      const start = new TextDecoder().decode(sliceBefore).length
      const end = start + new TextDecoder().decode(sliceInner).length

      return <Diagnostic>{
        severity: pd.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
        range: {
          start: textDocument.positionAt(start),
          end: textDocument.positionAt(end),
        },
        message: pd.help?.length ? `${pd.description}\n\nhelp: ${pd.help[0]}` : pd.description,
        source: 'pomsky',
        code: `${pd.kind} (${pd.code})`,
        tags: pd.kind === 'deprecated' ? [DiagnosticTag.Deprecated] : undefined,
      }
    })

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })

    noExeReported.clear()
  } catch (e: unknown) {
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] })

    if (e instanceof Error) {
      await handleError(e, settings, textDocument)
    }
  }
}

async function handleError(e: Error, settings: Config, document: TextDocument) {
  if (e instanceof NoExeError) {
    // only report this error once
    if (noExeReported.has(document.uri)) {
      return
    }
    noExeReported.set(document.uri, true)

    connection.sendNotification(ShowMessageNotification.type, {
      message: `Couldn't find the '${e.command}' executable!
If you downloaded it from GitHub, make sure to set its path in the settings!`,
      type: MessageType.Error,
    })
  } else {
    console.error(e.name, e.message)

    // TODO: Verify the path points to a file when the config is changed
    // show error in the settings dialogue?
    if (settings.executable.path && (await lstat(settings.executable.path)).isDirectory()) {
      // don't show this error, the user is probably typing in the settings editor right now
      return
    }

    connection.sendNotification(ShowMessageNotification.type, {
      message: `Error executing pomsky: ${e.message}`,
      type: MessageType.Error,
    })
  }
}

async function lstat(path: string) {
  return new Promise<fs.Stats>((resolve, reject) => {
    fs.lstat(path, (e, stats) => {
      if (e) reject(e)
      else resolve(stats)
    })
  })
}

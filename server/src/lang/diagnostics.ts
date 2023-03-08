import { Diagnostic, DiagnosticSeverity, DiagnosticTag, TextDocuments } from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { runPomskyWithErrorHandler } from './pomskyCli'
import { connection } from '../state'
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

export async function validateTextDocument(document: TextDocument): Promise<void> {
  const res = await runPomskyWithErrorHandler(connection, document)
  if (res === undefined) {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
    return
  }

  const text = document.getText()
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
        start: document.positionAt(start),
        end: document.positionAt(end),
      },
      message: pd.help?.length ? `${pd.description}\n\nhelp: ${pd.help[0]}` : pd.description,
      source: 'pomsky',
      code: `${pd.kind} (${pd.code})`,
      tags: pd.kind === 'deprecated' ? [DiagnosticTag.Deprecated] : undefined,
    }
  })

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

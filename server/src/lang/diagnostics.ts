import {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTag,
  TextDocuments,
  Range,
} from 'vscode-languageserver'
import { TextDocument } from 'vscode-languageserver-textdocument'

import { runPomskyWithErrorHandler } from './pomskyCli'
import { connection } from '../state'
import { TextDecoder, TextEncoder } from 'node:util'
import { PomskyJsonSpan } from '../types/pomskyCli'

export function initDiagnostics(documents: TextDocuments<TextDocument>) {
  // when the text document first opened or when its content has changed.
  documents.onDidChangeContent(change => {
    validateTextDocument(change.document)
  })

  documents.onDidClose(change => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics: [] })
  })
}

export async function validateTextDocument(document: TextDocument): Promise<void> {
  const res = await runPomskyWithErrorHandler(connection, document)
  if (res === undefined) {
    connection.sendDiagnostics({ uri: document.uri, diagnostics: [] })
    return
  }

  const text = document.getText()
  const encoded = res.diagnostics.length ? new TextEncoder().encode(text) : undefined

  const diagnostics = res.diagnostics.map<Diagnostic>(pd => ({
    severity: pd.severity === 'error' ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning,
    range: spanToRange(pd.spans[0] ?? { start: 0, end: 0 }, encoded!, document),
    message: pd.help?.length ? `${pd.description}\n\nhelp: ${pd.help[0]}` : pd.description,
    source: 'pomsky',
    code: `${pd.kind} (${pd.code})`,
    tags: pd.kind === 'deprecated' ? [DiagnosticTag.Deprecated] : undefined,
  }))

  connection.sendDiagnostics({ uri: document.uri, diagnostics })
}

function spanToRange(span: PomskyJsonSpan, encoded: Uint8Array, document: TextDocument): Range {
  const sliceBefore = encoded.slice(0, span.start)
  const sliceInner = encoded.slice(span.start, span.end)

  // convert UTF-8 byte offsets to UTF-16 code unit offsets
  const decoder = new TextDecoder()
  const start = decoder.decode(sliceBefore).length
  const end = start + decoder.decode(sliceInner).length

  return {
    start: document.positionAt(start),
    end: document.positionAt(end),
  }
}

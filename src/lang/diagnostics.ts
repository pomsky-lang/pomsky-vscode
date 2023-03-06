import {
  Diagnostic,
  DiagnosticCollection,
  DiagnosticSeverity,
  DiagnosticTag,
  Disposable,
  ExtensionContext,
  languages,
  Range,
  TextDocument,
  window,
  workspace,
} from 'vscode'
import { Config, getConfig } from '../config'
import { runPomsky } from '../pomskyCli'

interface DiagnosticsContext {
  contents: Map<string, string>
}

export function activateDiagnostics(_context: ExtensionContext) {
  const disposables: Disposable[] = []
  const coll = languages.createDiagnosticCollection('pomsky')

  const contents = new Map<string, string>()
  const context: DiagnosticsContext = { contents }

  window.onDidChangeActiveTextEditor(
    editor => {
      if (editor) {
        analyze(getConfig(editor.document.uri), coll, editor.document, context)
      }
    },
    null,
    disposables,
  )

  workspace.onDidChangeTextDocument(
    event => {
      analyze(getConfig(event.document.uri), coll, event.document, context)
    },
    null,
    disposables,
  )

  if (window.activeTextEditor) {
    analyze(
      getConfig(window.activeTextEditor.document.uri),
      coll,
      window.activeTextEditor.document,
      context,
    )
  }
}

function analyze(
  config: Config,
  coll: DiagnosticCollection,
  doc: TextDocument,
  context: DiagnosticsContext,
) {
  if (!/\.pom(?:sky)?$/.test(doc.fileName)) {
    return
  }

  const content = doc.getText()
  context.contents.set(doc.fileName, content)
  updateContent(config, coll, doc, content)
}

function updateContent(
  config: Config,
  coll: DiagnosticCollection,
  doc: TextDocument,
  content: string,
) {
  runPomsky(config, content, doc.fileName).then(res => {
    if (res) {
      if (res.diagnostics?.length) {
        coll.set(
          doc.uri,
          res.diagnostics.map(diagnostic => {
            const span = diagnostic.spans[0]
            const result = new Diagnostic(
              new Range(doc.positionAt(span.start), doc.positionAt(span.end)),
              diagnostic.help?.length
                ? `${diagnostic.description}\n\nhelp: ${diagnostic.help[0]}`
                : diagnostic.description,
              diagnostic.severity === 'error'
                ? DiagnosticSeverity.Error
                : DiagnosticSeverity.Warning,
            )
            result.source = 'pomsky'
            result.code = `${diagnostic.kind} (${diagnostic.code})`
            if (diagnostic.kind === 'deprecated') {
              result.tags = [DiagnosticTag.Deprecated]
            }
            return result
          }),
        )
      } else {
        coll.set(doc.uri, [])
      }
    }
  })
}

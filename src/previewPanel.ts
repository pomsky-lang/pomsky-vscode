import {
  commands,
  Disposable,
  ExtensionContext,
  TextDocument,
  Uri,
  ViewColumn,
  WebviewOptions,
  WebviewPanel,
  window,
  workspace,
} from 'vscode'
import { getNonce } from './nonce'
import { singleton } from './singleton'
import { PomskyJsonDiagnostic, runPomsky } from './pomskyCli'

export interface State {
  fileName: string
  content: string
  compileResult?: CompileResult
  isCompiling: boolean
}

export interface CompileResult {
  output?: string
  exeError?: string
  diagnostics?: PomskyJsonDiagnostic[]
  timings?: { all: number }
  actualLength?: number
}

export type Message = { setState: State } | { setCompiling: boolean }

export function activatePanel(context: ExtensionContext) {
  context.subscriptions.push(
    commands.registerCommand('pomsky.openPreview', () => {
      panelSingleton.getOrInit(context.extensionUri)
    }),
  )

  if (window.registerWebviewPanelSerializer) {
    window.registerWebviewPanelSerializer(viewType, {
      async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: unknown) {
        console.log(`Got state:`, state)
        // Reset the webview options so we use latest uri for `localResourceRoots`.
        webviewPanel.webview.options = getWebviewOptions(context.extensionUri)
        panelSingleton.dispose()
        panelSingleton.getOrInit(context.extensionUri, webviewPanel)
      },
    })
  }
}

const viewType = 'pomsky.preview'
const defaultColumn = ViewColumn.Beside

const panelSingleton = singleton((extUri: Uri, panel?: WebviewPanel) => {
  if (panel) {
    panel.reveal(defaultColumn)
  } else {
    panel = window.createWebviewPanel(viewType, 'Pomsky', defaultColumn, getWebviewOptions(extUri))
  }

  initPanel({
    extUri,
    panel,
    document: window.activeTextEditor?.document,
  })
  return panel
})

const getWebviewOptions = (extUri: Uri): WebviewOptions => ({
  enableScripts: true,
  // restrict webview to only loading content from our extension's `media` directory
  localResourceRoots: [Uri.joinPath(extUri, 'media')],
})

interface PanelContext {
  extUri: Uri
  panel: WebviewPanel
  document?: TextDocument
  content?: string
  compileResult?: CompileResult
}

function initPanel(context: PanelContext) {
  const disposables: Disposable[] = []

  updatePanel(context)

  // Listen for when the panel is disposed
  // This happens when the user closes the panel or when the panel is closed programmatically
  context.panel.onDidDispose(
    () => {
      context.panel.dispose()
      disposables.forEach(d => d.dispose())
      disposables.length = 0
      panelSingleton.dispose()
    },
    null,
    disposables,
  )

  // Update the content based on view changes
  context.panel.onDidChangeViewState(
    () => {
      if (context.panel.visible) {
        updatePanel(context)
      }
    },
    null,
    disposables,
  )

  // Handle messages from the webview
  context.panel.webview.onDidReceiveMessage(
    message => {
      switch (message.command) {
        case 'alert':
          window.showErrorMessage(message.text)
          return
      }
    },
    null,
    disposables,
  )

  workspace.onDidChangeTextDocument(
    event => {
      if (event.document.fileName === context.document?.fileName) {
        updateContent(context)
      }
    },
    null,
    disposables,
  )

  if (context.document) {
    const { path } = context.document.uri
    const lastSlash = path.replace(/\/+$/, '').lastIndexOf('/')
    const fileName = path.slice(lastSlash + 1)
    context.panel.title = `Pomsky [${fileName}]`
  } else {
    context.panel.title = `Pomsky`
  }
}

function updatePanel(context: PanelContext) {
  context.panel.webview.html = getHtmlForWebview(context)
  updateContent(context)
}

function updateContent(context: PanelContext) {
  const fileName = context.document?.fileName
  context.content = context.document?.getText()

  if (context.content !== undefined) {
    let completed = false
    let isCompiling = true

    setTimeout(() => {
      if (!completed) {
        context.panel.webview.postMessage({
          setCompiling: isCompiling,
        } as Message)
      }
    }, 10)

    runPomsky('js', context.content, '//preview')
      .then(
        res => {
          if (res !== undefined) {
            // isCompiling is only set to `false` if `res` is defined!
            isCompiling = false
            context.compileResult = {
              output: trimLength(res.output, 100_000),
              actualLength: res.output?.length,
              diagnostics: res.diagnostics,
              timings: res.timings,
            }
          }
        },
        (e: Error) => {
          console.warn('[POMSKY]', e)
          isCompiling = false
          context.compileResult = { exeError: e.message }
        },
      )
      .finally(() => {
        completed = true

        context.panel.webview.postMessage({
          setState: {
            fileName,
            content: context.content,
            compileResult: context.compileResult,
            isCompiling,
          },
        } as Message)
      })
  }
}

function getHtmlForWebview({ extUri, panel: { webview } }: PanelContext) {
  const scriptPath = Uri.joinPath(extUri, 'media', 'script.js')
  const stylePath = Uri.joinPath(extUri, 'media', 'style.css')

  const scriptUri = webview.asWebviewUri(scriptPath)
  const stylesUri = webview.asWebviewUri(stylePath)

  const nonce = getNonce()

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link href="${stylesUri}" rel="stylesheet">
    <title>Pomsky Preview</title>
  </head>
  <body>
    <div id="exeError"></div>
    <pre id="pre"></pre>

    <div id="warnings"></div>
    <pre id="diagnostics"></pre>

    <div id="footer">
      <div id="version"></div>
      <div id="timing"></div>
    </div>

    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
  </html>`
}

function trimLength(output: string | undefined, len: number) {
  if (output !== undefined) {
    return output.slice(0, len)
  }
}

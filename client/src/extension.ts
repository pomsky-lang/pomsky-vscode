import * as path from 'node:path'
import { ExtensionContext } from 'vscode'

import {
  Disposable,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node'
import { activatePanel } from './previewPanel'
import { initStatusBar } from './statusBar'

let client: LanguageClient
const disposables: Disposable[] = []

export function activate(context: ExtensionContext) {
  const serverModule = context.asAbsolutePath(path.join('dist', 'server.js'))

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc },
  }

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for plain text documents
    documentSelector: [{ scheme: 'file', language: 'pomsky' }],
  }

  client = new LanguageClient('pomsky', 'Pomksy', serverOptions, clientOptions)

  activatePanel(context, client)

  // Start the client. This will also launch the server
  client.start()

  initStatusBar(client, disposables)
}

export async function deactivate() {
  for (const disposable of disposables) {
    disposable.dispose()
  }
  disposables.length = 0

  if (client) {
    await client.stop()
  }
}

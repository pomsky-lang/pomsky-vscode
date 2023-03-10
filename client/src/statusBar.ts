import { commands, languages, workspace } from 'vscode'
import { Disposable } from 'vscode-languageclient'
import { LanguageClient } from 'vscode-languageclient/node'

type ExeVersion = { versionInfo: string } | { error: Error }

export function initStatusBar(client: LanguageClient, disposables: Disposable[]) {
  disposables.push(
    commands.registerCommand('pomsky.executable.set', () => {
      commands.executeCommand('workbench.action.openSettings', 'pomsky.executable')
    }),
  )

  const versionItem = languages.createLanguageStatusItem('pomsky-version', { language: 'pomsky' })
  versionItem.name = 'Pomsky version'
  versionItem.text = '$(info) Version info unavailable'
  versionItem.command = {
    title: 'set executable',
    command: 'pomsky.executable.set',
    tooltip: 'set path to executable',
  }

  disposables.push({
    dispose: () => versionItem.dispose(),
  })
  disposables.push(
    client.onNotification('handler/exeVersion', (version: ExeVersion) => {
      if ('versionInfo' in version) {
        const versionNumber = version.versionInfo.replace(/^pomsky\s+/i, '')
        versionItem.text = `$(info) Pomsky ${versionNumber}`
      } else {
        versionItem.text = '$(error) Error getting version'
      }
    }),
  )

  const timeout = setTimeout(() => {
    client.sendRequest('handler/getExeVersion', {})
  }, 1000)
  disposables.push({
    dispose: () => clearTimeout(timeout),
  })
  disposables.push(
    workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('pomsky.executable.path')) {
        // wait a bit so the config on the server is up to date
        setTimeout(() => {
          client.sendRequest('handler/getExeVersion', {})
        }, 200)
      }
    }),
  )
}

const vscode = acquireVsCodeApi()

const exeErrorDiv = document.getElementById('exeError')
const outputPre = document.getElementById('pre')
const warningsDiv = document.getElementById('warnings')
const diagnosticsPre = document.getElementById('diagnostics')

/**
 * @typedef {import('../src/previewPanel').Message} Message
 * @typedef {import('../src/previewPanel').State} State
 */

window.addEventListener('message', (/** @type {{ data: Message }} */ { data }) => {
  vscode.setState(data.setState)
  render(data.setState)
})

function render(/** @type {State} */ state) {
  if (state.compileResult) {
    const { compileResult } = state
    if (compileResult.exeError) {
      outputPre.textContent = ''
      exeErrorDiv.innerText = compileResult.exeError
      diagnosticsPre.textContent = ''
    } else {
      outputPre.textContent = compileResult.output ?? ''
      exeErrorDiv.textContent = ''

      if (compileResult.diagnostics == null) {
        return
      }

      const errors = compileResult.diagnostics.filter(d => d.severity === 'error').length
      const warnings = compileResult.diagnostics.filter(d => d.severity === 'warning').length

      if (errors > 0 || warnings > 0) {
        warningsDiv.textContent = [
          `${errors} error${errors > 1 ? 's' : ''}`,
          `${warnings} warning${warnings > 1 ? 's' : ''}`,
        ]
          .filter((_, i) => (i === 0 ? errors > 0 : warnings > 0))
          .join(' and ')
        if (errors > 0) {
          warningsDiv.classList.add('errors')
        } else {
          warningsDiv.classList.remove('errors')
        }

        diagnosticsPre.textContent = compileResult.diagnostics.map(d => d.visual).join('\n\n')
      } else {
        diagnosticsPre.textContent = ''
        warningsDiv.textContent = ''
      }
    }
  }
}

render(vscode.getState())

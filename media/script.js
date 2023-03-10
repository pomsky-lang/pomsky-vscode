const vscode = acquireVsCodeApi()

const outputPre = document.getElementById('pre')
const diagnosticsDetails = document.getElementById('diagnostics')

const flavorSelect = document.getElementById('flavorSelect')
flavorSelect.addEventListener('change', () => {
  vscode.postMessage({ setFlavor: flavorSelect.value })
})

/**
 * @typedef {import('../client/src/previewPanel').Message} Message
 * @typedef {import('../client/src/previewPanel').State} State
 */

/** @type {State} */
let state = vscode.getState() ?? {}

window.addEventListener('message', (/** @type {{ data: Message }} */ { data }) => {
  if ('setState' in data) {
    state = data.setState
  } else if ('setError' in data) {
    state.isCompiling = false
    state.compileResult = undefined
    state.versionInfo = undefined
  }
  vscode.setState(state)
  render(state)
})

function render(/** @type {State} */ state) {
  if (state?.compileResult) {
    const { compileResult } = state
    if (compileResult == null) {
      setOutput({ isCompiling: state.isCompiling })
    } else if (compileResult.diagnostics == null || compileResult.diagnostics.length === 0) {
      setOutput({
        output: compileResult.output ?? '',
        actualLength: compileResult.actualLength,
        timing: compileResult.timings?.all,
      })
    } else {
      const errors = compileResult.diagnostics.filter(d => d.severity === 'error').length
      const warnings = compileResult.diagnostics.filter(d => d.severity === 'warning').length

      const warningsLabel = [
        `${errors} error${errors > 1 ? 's' : ''}`,
        `${warnings} warning${warnings > 1 ? 's' : ''}`,
      ]
        .filter((_, i) => (i === 0 ? errors > 0 : warnings > 0))
        .join(' and ')

      setOutput({
        output: compileResult.output ?? '',
        actualLength: compileResult.actualLength,
        warningsLabel,
        diagnostics: compileResult.diagnostics.map(d => d.visual).join('\n\n'),
        hasErrors: errors > 0,
      })
    }
  } else {
    clearOutput()
  }
}

function setOutput({
  output = '',
  actualLength = 0,
  warningsLabel = '',
  diagnostics = '',
  hasErrors = false,
}) {
  outputPre.textContent =
    actualLength > output.length
      ? `${output}\n\nOutput is too big to display! Only the first ${output.length} code units are shown. The actual length is ${actualLength}`
      : output

  diagnosticsDetails.innerHTML = ''
  if (diagnostics !== '') {
    const warningsSummary = document.createElement('summary')
    if (hasErrors) {
      warningsSummary.classList.add('errors')
    }
    warningsSummary.id = 'warnings'
    warningsSummary.textContent = warningsLabel

    const diagnosticsPre = document.createElement('pre')
    diagnosticsPre.textContent = diagnostics

    diagnosticsDetails.append(warningsSummary, diagnosticsPre)
  }
}

function clearOutput() {
  outputPre.textContent = ''
  diagnosticsDetails.textContent = ''
}

if (state != null) {
  render(state)
}

const vscode = acquireVsCodeApi()

const outputPre = document.getElementById('pre')
const diagnosticsDetails = document.getElementById('diagnostics')

const versionDiv = document.getElementById('version')
const timingDiv = document.getElementById('timing')

/**
 * @typedef {import('../client/src/previewPanel').Message} Message
 * @typedef {import('../client/src/previewPanel').State} State
 */

/** @type {State} */
let state = vscode.getState() ?? {}
let dirty = false

window.addEventListener('message', (/** @type {{ data: Message }} */ { data }) => {
  if ('setState' in data) {
    state = data.setState
  } else if ('setCompiling' in data) {
    state.isCompiling = data.setCompiling
    if (state.compileResult?.timings) {
      dirty = true
      vscode.setState(state)
      // defer rendering to avoid flickering while typing
      setTimeout(() => {
        if (dirty) {
          render(vscode.getState() ?? {})
        }
      }, 30)
      return
    }
  } else if ('setError' in data) {
    state.isCompiling = false
    state.compileResult = undefined
    state.versionInfo = undefined
  }
  vscode.setState(state)
  render(state)
})

function render(/** @type {State} */ state) {
  dirty = false

  if (state?.compileResult) {
    const { compileResult } = state
    if (compileResult == null) {
      setOutput({ isCompiling: state.isCompiling })
    } else if (compileResult.diagnostics == null || compileResult.diagnostics.length === 0) {
      setOutput({
        output: compileResult.output ?? '',
        actualLength: compileResult.actualLength,
        timing: compileResult.timings?.all,
        isCompiling: state.isCompiling,
        flavor: state.flavor,
        versionInfo: state.versionInfo,
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
        timing: compileResult.timings.all,
        isCompiling: state.isCompiling,
        flavor: state.flavor,
        versionInfo: state.versionInfo,
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
  timing,
  isCompiling = false,
  flavor,
  versionInfo,
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

  if (isCompiling) {
    timingDiv.textContent = `compiling...`
    timingDiv.classList.add('compiling')
  } else if (timing != null) {
    timingDiv.textContent = `compiled in ${displayTime(timing)}`
    timingDiv.classList.remove('compiling')
  }

  if (flavor) {
    versionDiv.textContent = `${versionInfo ?? 'Pomsky'} (${flavor} flavor)`
  } else {
    versionDiv.textContent = ''
  }
}

function clearOutput() {
  outputPre.textContent = ''
  diagnosticsDetails.textContent = ''
  timingDiv.textContent = ''
  versionDiv.textContent = ''
}

if (state != null) {
  render(state)
}

function displayTime(/** @type {number} */ micros) {
  if (micros >= 1_000_000) {
    const secs = micros / 1_000_000
    if (secs < 9.5) {
      return `${secs.toFixed(1)} s`
    }

    let time = `${Math.round(secs % 60)} s`
    const mins = (secs / 60) | 0
    if (mins > 0) {
      time = `${mins} min ${time}`
    }
    return time
  } else if (micros >= 1000) {
    const millis = micros / 1000
    return `${millis >= 9.5 ? Math.round(millis) : millis.toFixed(1)} ms`
  } else {
    return `${(micros / 1000).toFixed(2)} ms`
  }
}

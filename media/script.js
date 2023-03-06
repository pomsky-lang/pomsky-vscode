const vscode = acquireVsCodeApi()

const exeErrorDiv = document.getElementById('exeError')
const outputPre = document.getElementById('pre')
const warningsDiv = document.getElementById('warnings')
const diagnosticsPre = document.getElementById('diagnostics')

const versionDiv = document.getElementById('version')
const timingDiv = document.getElementById('timing')

/**
 * @typedef {import('../src/previewPanel').Message} Message
 * @typedef {import('../src/previewPanel').State} State
 */

/** @type {State} */
let state = vscode.getState()

window.addEventListener('message', (/** @type {{ data: Message }} */ { data }) => {
  if ('setState' in data) {
    state = data.setState
  } else if ('setCompiling' in data) {
    if (state == null) {
      state = {}
    }
    state.isCompiling = data.setCompiling
  }
  vscode.setState(state)
  render(state)
})

function render(/** @type {State} */ state) {
  if (state.compileResult) {
    const { compileResult } = state
    if (compileResult == null || (compileResult.exeError && state.isCompiling)) {
      setOutput({ isCompiling: state.isCompiling })
    } else if (compileResult.exeError) {
      setExeError(compileResult.exeError)
    } else if (compileResult.diagnostics == null || compileResult.diagnostics.length === 0) {
      setOutput({
        output: compileResult.output ?? '',
        actualLength: compileResult.actualLength,
        timing: compileResult.timings?.all,
        isCompiling: state.isCompiling,
        flavor: state.flavor,
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
      })
    }
  }
}

function setExeError(error) {
  exeErrorDiv.innerText = error
  outputPre.textContent = ''
  warningsDiv.textContent = ''
  diagnosticsPre.textContent = ''
  timingDiv.textContent = ''
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
}) {
  exeErrorDiv.innerText = ''
  outputPre.textContent =
    actualLength > output.length
      ? `${output}\n\nOutput is too big to display! Only the first ${output.length} code units are shown. The actual length is ${actualLength}`
      : output

  warningsDiv.textContent = warningsLabel
  diagnosticsPre.textContent = diagnostics

  if (hasErrors) {
    warningsDiv.classList.add('errors')
  } else {
    warningsDiv.classList.remove('errors')
  }

  if (isCompiling) {
    timingDiv.textContent = `compiling...`
  } else if (timing != null) {
    timingDiv.textContent = `compiled in ${displayTime(timing)}`
  }

  if (flavor) {
    versionDiv.textContent = `Pomsky (${flavor} flavor)`
  } else {
    versionDiv.textContent = ''
  }
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

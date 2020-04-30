const path = require('path')

// customize console style
const style = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m'
}

// pad string to desire length
const pad = function (s, l, f) {
  if (f) {
    return s.padStart(l)
  } else {
    return s.padEnd(l)
  }
}

// flatten a nested array
// const flatten = function (a) {
//   return Array.isArray(a) ? [].concat(...a.map(flatten)) : a
// }

// get the base name
const base = function (x) {
  let baseName = path.parse(x).base
  if (x.search(/https?:/) === 0) {
    if (baseName.indexOf('?') > -1) {
      baseName = baseName.substring(0, baseName.indexOf('?'))
    }
    if (baseName.indexOf('#') > -1) {
      baseName = baseName.substring(0, baseName.indexOf('#'))
    }
  }
  return baseName
}

// log to the console in green
const printGreen = function (msg) {
  console.log(`  ${style.green}${msg}${style.reset}`)
}

/**
 * Logs the summary to the console
 */
const logSummary = function (action, imagePath, objectName, summary) {
  if (summary) {
    if (Array.isArray(summary)) {
      switch (action) {
        case 'save':
        case 'remove':
          if (objectName) {
            logSaveObject(imagePath, summary, objectName, (action === 'remove'))
          } else {
            logSave(imagePath, summary, (action === 'remove'))
          }
          break
        default:
          if (objectName) {
            logContainsObject(imagePath, summary, objectName)
          } else {
            logContains(imagePath, summary)
          }
          break
      }
    } else {
      printGreen(summary)
    }
  }
}

/**
 * Logs the 'contains' summary to the console
 */
const logContains = function (imagePaths, containsResults) {
  if (containsResults && containsResults.length) {
    const max = imagePaths.reduce((p, c) => {
      return Math.max(base(c).length, p)
    }, 0)
    containsResults.forEach((results, i) => {
      const filtered = results.filter(r => {
        return r !== 'background'
      })
      if (filtered.length) {
        printGreen(`${pad(base(imagePaths[i]), max)} contains [${filtered.join(', ')}]`)
      } else {
        printGreen(`${pad(base(imagePaths[i]), max)} contains no known objects`)
      }
    })
  }
}

/**
 * Logs the 'contains' summary by object to the console
 */
const logContainsObject = function (imagePaths, containsResults, objectName) {
  if (objectName && imagePaths) {
    const yes = []
    const no = []
    if (!Array.isArray(imagePaths)) {
      imagePaths = [imagePaths]
    }

    if (containsResults && containsResults.length) {
      containsResults.forEach((results, i) => {
        if (!results) {
          no.push(base(imagePaths[i]))
        } else {
          // ignore background unless explicitly requested
          const filtered = objectName === 'background' ? results : results.filter(r => {
            return r !== 'background'
          })
          if (filtered.length) {
            yes.push(base(imagePaths[i]))
          } else {
            no.push(base(imagePaths[i]))
          }
        }
      })
    } else {
      imagePaths.forEach(img => {
        no.push(base(img))
      })
    }

    if (yes.length === 1) {
      printGreen(`[${objectName}] found in ${yes[0]}`)
    } else if (yes.length > 1) {
      printGreen(`[${objectName}] found in`)
      yes.forEach(y => printGreen(`  ${y}`))
    }

    if (no.length === 1) {
      printGreen(`[${objectName}] not found in ${no[0]}`)
    } else if (no.length > 1) {
      printGreen(`[${objectName}] not found in`)
      no.forEach(n => printGreen(`  ${n}`))
    }
  }
}

/**
 * Logs the 'save'/'remove' summary to the console
 */
const logSave = function (imagePaths, saveResults, removed) {
  if (saveResults && saveResults.length) {
    let max = 0
    saveResults.forEach(sr => {
      max = Math.max(max, sr.reduce((p, c) => {
        return c && c.segment ? Math.max(c.segment.length, p) : 0
      }, 0))
    })
    saveResults.forEach((results, i) => {
      if (results && results.length) {
        printGreen(`${base(imagePaths[i])}`)
        results.forEach(result => {
          // status, segment, and output
          if (result.status === 'saved') {
            printGreen(`  ${pad('[' + result.segment + ']', max + 2)} saved as ${result.output}`)
          } else if (result.status === 'removed') {
            printGreen(`  ${pad('[' + result.segment + ']', max + 2)} removed and saved as ${result.output}`)
          } else {
            printGreen(`  ${result.status} [${result.segment}]: ${result.output}`)
          }
        })
      } else {
        printGreen(`${base(imagePaths[i])} contains no known objects`)
      }
    })
  }
}

/**
 * Logs the 'save'/'remove' summary by object to the console
 */
const logSaveObject = function (imagePaths, saveResults, objectName, removed) {
  if (saveResults && saveResults.length) {
    const yes = []
    const no = []
    let max = 0

    saveResults.forEach((results, i) => {
      if (results && results.length) {
        const img = base(imagePaths[i])
        max = Math.max(max, img.length)
        results.forEach(result => {
          if (result.status === 'saved' || result.status === 'removed') {
            yes.push(`${img} saved as ${result.output}`)
          } else {
            yes.push(`${img} ${result.status}: ${result.output}`)
          }
        })
      } else {
        no.push(base(imagePaths[i]))
      }
    })

    if (yes.length) {
      if (removed) {
        printGreen(`[${objectName}] removed from`)
      } else {
        printGreen(`[${objectName}] found in`)
      }
      yes.forEach(y => printGreen(`  ${y.split(' ')[0]}${' '.repeat(max - y.indexOf(' '))}${y.substring(y.indexOf(' '))}`))
    }

    if (no.length === 1) {
      printGreen(`[${objectName}] not found in ${no[0]}`)
    } else if (no.length > 1) {
      printGreen(`[${objectName}] not found in`)
      no.forEach(n => printGreen(`  ${n}`))
    }
  }
}

/**
 * Logs to the console the message in red and prepended with 'error:'
 */
const logError = function (err, exit) {
  console.error(`${style.red}error: ${err.message || err}${style.reset}`)
  if (exit) {
    process.exit(1)
  }
}

module.exports = {
  style: style,
  logSummary: logSummary,
  logError: logError
}

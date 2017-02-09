/* jshint -W069 */
/*
 * THIS SOFTWARE IS PROVIDED ``AS IS'' AND ANY EXPRESSED OR IMPLIED
 * WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES
 * OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED.  IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
 * HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
 * STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING
 * IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

'use strict'

var fs = require('fs')
var split = require('split2')
var pump = require('pump')
var _ = require('lodash')
var chalk = require('chalk')
var readline = require('readline')


module.exports = function () {
  var colourSelector = 0

  var isExecutableContainer = function (container) {
    var result = false

    result = (['node', 'process'].indexOf(container.type) !== -1) && container.run
    if (!result) {
      result = (['docker', 'container'].indexOf(container.type) !== -1) && container.image
    }
    return result
  }



  var findProcess = function (processes, name) {
    var pid = _.find(_.keys(processes), function (key) { return processes[key].identifier === name })
    return processes[pid]
  }



  var findContainer = function (system, name) {
    return _.find(system.topology.containers, function (c) { return c.name === name })
  }


  var selectColourWhite = function () {
    return chalk.white
  }


  var selectColour = function (processes, name) {
    var colour
    var process

    if (processes) {
      process = findProcess(processes, name)
    }

    if (process) {
      colour = process.colour
    } else {
      var colours = [chalk.white,
        chalk.green,
        chalk.yellow,
        chalk.blue,
        chalk.magenta,
        chalk.cyan,
        chalk.gray]
      colour = colours[colourSelector]
      colourSelector++
      if (colourSelector === colours.length) {
        colourSelector = 0
      }
    }
    return colour
  }



  var streamOutput = function (proc, logPath) {
    var colorizer = split(function (line) {
      if (proc.tail) {
        return proc.colour('[' + proc.identifier + ' - ' + proc.child.pid + ']: ' + line) + '\n'
      }
    })
    var errorColorizer = split(function (line) {
      return chalk.red('[' + proc.identifier + ' - ' + proc.child.pid + ']: ' + line) + '\n'
    })
    var logStream = fs.createWriteStream(logPath + '/' + proc.identifier + '.log')

    pump(proc.child.stdout, colorizer)
    colorizer.pipe(process.stdout, { end: false })
    pump(proc.child.stdout, logStream)

    if (proc.child.stderr) {
      pump(proc.child.stderr, errorColorizer)
      errorColorizer.pipe(process.stdout, { end: false })
      pump(proc.child.stderr, logStream)
    }
  }



  var showLogTail = function (name, proc, logPath, count, cb) {
    var path = logPath + '/' + name + '.log'
    var lines = []

    if (fs.existsSync(path)) {
      var instream = fs.createReadStream(path)
      var rl = readline.createInterface({
        input: instream
      })

      rl.on('line', function (line) {
        lines.push(line)
        if (lines.length > count) {
          lines.shift()
        }
      })

      rl.on('close', function () {
        _.each(lines, function (line) {
          if (proc) {
            console.log(proc.colour(line))
          } else {
            console.log(line)
          }
        })
        cb()
      })
    } else {
      cb()
    }
  }



  function tokenizeQuoted (str, quote) {
    var tokens = [].concat.apply([], str.split(quote).map(function (v, i) {
      return i % 2 ? quote + v + quote : v.split(' ')
    })).filter(Boolean)
    return tokens
  }



  function tokenizeCommand (str) {
    var toks

    if (str.indexOf('\'') !== -1) {
      toks = tokenizeQuoted(str, '\'')
    } else if (str.indexOf('"') !== -1) {
      toks = tokenizeQuoted(str, '"')
    } else {
      toks = str.split(' ')
    }
    return toks
  }



  return {
    isExecutableContainer: isExecutableContainer,
    selectColour: selectColour,
    streamOutput: streamOutput,
    findContainer: findContainer,
    findProcess: findProcess,
    showLogTail: showLogTail,
    tokenizeCommand: tokenizeCommand,
    selectColourWhite: selectColourWhite
  }
}

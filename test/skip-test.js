var test = require('tape')
var path = require('path')
var exec = require('child_process').exec
var execFileSync = require('child_process').execFileSync
var fs = require('fs')
var tempy = require('tempy') // Locked to 0.2.1 for node 6 support
var cleanEnv = require('./util/clean-env')
var npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

test('skips download in git dependency', function (t) {
  // We're not testing this flag. Just that we do hit the code paths before it
  run(t, 'git', '--build-from-source', function (logs) {
    t.is(logs.pop(), 'prebuild-install info install installing from git repository, skipping download.')
    t.end()
  })
})

test('does not skip download in normal dependency', function (t) {
  // We're not testing this flag. Just that we don't hit the code paths before it
  run(t, 'tarball', '--build-from-source', function (logs) {
    t.is(logs.pop(), 'prebuild-install info install --build-from-source specified, not attempting download.')
    t.end()
  })
})

test('does not skip download in standalone package', function (t) {
  // We're not testing this flag. Just that we don't hit the code paths before it
  run(t, 'standalone', '--build-from-source', function (logs) {
    t.is(logs.pop(), 'prebuild-install info install --build-from-source specified, not attempting download.')
    t.end()
  })
})

function run (t, mode, args, cb) {
  var addon = tempy.directory()
  var logfile = path.join(addon, 'prebuild-install.log')
  var cwd = addon

  writePackage(addon, {
    name: 'addon',
    version: '1.0.0',
    scripts: {
      install: 'node ' + path.resolve(__dirname, '..', 'bin.js') + ' ' + args + ' || exit 0'
    }
  })

  if (mode !== 'standalone') {
    // Install as dependency of an app
    cwd = tempy.directory()

    writePackage(cwd, {
      name: 'app',
      dependencies: {
        addon: mode === 'git' ? prepareGit(addon) : prepareTarball(addon)
      }
    })
  }

  var env = Object.assign(cleanEnv(process.env), {
    // We shouldn't hit npm or github
    npm_config_registry: 'http://localhost:1234',
    npm_config_addon_binary_host: 'http://localhost:1234',
    npm_config_prefer_offline: 'true',
    npm_config_audit: 'false',

    // Temporary workaround for npm 7 which swallows our output
    npm_config_prebuild_install_logfile: logfile,
    npm_config_loglevel: 'info'
  })

  exec(npm + ' install', { cwd, env }, function (err) {
    t.ifError(err, 'no install error')

    fs.readFile(logfile, 'utf8', function (err, data) {
      t.ifError(err, 'no read error')
      cb(logs(data))
    })
  })
}

function writePackage (cwd, pkg) {
  fs.writeFileSync(path.join(cwd, 'package.json'), JSON.stringify(pkg))
}

function prepareGit (cwd) {
  execFileSync('git', ['init', '.'], { cwd, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'test'], { cwd, stdio: 'ignore' })
  execFileSync('git', ['config', 'user.email', 'test@localhost'], { cwd, stdio: 'ignore' })
  execFileSync('git', ['add', 'package.json'], { cwd, stdio: 'ignore' })
  execFileSync('git', ['commit', '-m', 'test'], { cwd, stdio: 'ignore' })

  if (process.platform === 'win32' && npmVersion() >= 7) {
    // Otherwise results in invalid url error
    return 'git+file:///' + cwd
  }

  return 'git+file://' + cwd
}

function npmVersion () {
  return parseInt(execFileSync(npm, ['-v']).toString())
}

function prepareTarball (cwd) {
  // Packs to <name>-<version>.tgz
  execFileSync(npm, ['pack'], { cwd, stdio: 'ignore' })

  return 'file:' + path.join(cwd, 'addon-1.0.0.tgz')
}

function logs (stderr) {
  return (stderr || '').split(/\r?\n/).filter(isOurs).map(stripPrefix)
}

function isOurs (line) {
  return /^(npm ERR! )?prebuild-install /.test(line)
}

function stripPrefix (line) {
  return line.replace(/^npm ERR! /, '')
}

var test = require('tape')
var path = require('path')
var exec = require('child_process').exec
var execFileSync = require('child_process').execFileSync
var fs = require('fs')
var tempy = require('tempy') // Locked to 0.2.1 for node 6 support
var cleanEnv = require('./util/clean-env')

// Old npm (v3?) doesn't support the mechanisms of this test
var npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
var supported = execFileSync(npm, ['-v']).toString().match(/^(\d+)\./)[1] > 3

supported && test('skips download in standalone package', function (t) {
  run(t, 'standalone', '', function (code, logs) {
    t.is(code, 1)
    t.is(logs.pop(), 'prebuild-install info install installing standalone, skipping download.')
    t.end()
  })
})

supported && test('skips download in git dependency', function (t) {
  run(t, 'git', '', function (code, logs) {
    t.is(code, 1)
    t.is(logs.pop(), 'prebuild-install info install installing from git repository, skipping download.')
    t.end()
  })
})

supported && test('does not skip download in normal dependency', function (t) {
  // We're not testing this flag. Just that we don't hit the code paths before it
  run(t, 'tarball', '--build-from-source', function (code, logs) {
    t.is(code, 1)
    t.is(logs.pop(), 'prebuild-install info install --build-from-source specified, not attempting download.')
    t.end()
  })
})

function run (t, mode, args, cb) {
  var addon = tempy.directory()
  var cwd = addon

  writePackage(addon, {
    name: 'addon',
    version: '1.0.0',
    dependencies: {
      'prebuild-install': 'file:' + path.dirname(__dirname)
    },
    scripts: {
      // TODO: npm 7 cannot find "prebuild-install" command in tarball mode
      install: 'prebuild-install ' + args
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
    npm_config_addon_binary_host: 'http://localhost:1234'
  })

  exec(npm + ' install --loglevel=info', { cwd, env, encoding: 'utf8' }, function (err, stdout, stderr) {
    cb(err && err.code, logs(stderr))
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

  return 'git+file://' + cwd
}

function prepareTarball (cwd) {
  // Packs to <name>-<version>.tgz
  execFileSync(npm, ['pack'], { cwd, stdio: 'ignore' })

  return 'file:' + path.join(cwd, 'addon-1.0.0.tgz')
}

function logs (stderr) {
  return (stderr || '').split(/\r?\n/).filter(isOurs)
}

function isOurs (line) {
  return /^prebuild-install /.test(line)
}

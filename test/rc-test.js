const test = require('tape')
const path = require('path')
const exec = require('child_process').exec
const fs = require('fs')
const tempy = require('tempy') // Locked to 0.2.1 for node 6 support
const cleanEnv = require('./util/clean-env')

test('custom config and aliases', function (t) {
  const args = [
    '--arch ARCH',
    '--platform PLATFORM',
    '--download https://foo.bar',
    '--debug',
    '--version',
    '--help',
    '--path ../some/other/path',
    '--target 1.4.10',
    '--runtime electron',
    '--token TOKEN'
  ]
  runRc(t, args.join(' '), {}, function (rc, tmp) {
    t.equal(rc.arch, 'ARCH', 'correct arch')
    t.equal(rc.arch, rc.a, 'arch alias')
    t.equal(rc.platform, 'PLATFORM', 'correct platform')
    t.equal(rc.download, 'https://foo.bar', 'download is set')
    t.equal(rc.download, rc.d, 'download alias')
    t.equal(rc.debug, true, 'debug is set')
    t.equal(rc.version, true, 'version is set')
    t.equal(rc.version, rc.v, 'version alias')
    t.equal(rc.help, true, 'help is set')
    t.equal(rc.help, rc.h, 'help alias')
    t.equal(rc.path, path.resolve(tmp, '../some/other/path'), 'correct path')
    t.equal(rc.target, '1.4.10', 'correct target')
    t.equal(rc.target, rc.t, 'target alias')
    t.equal(rc.runtime, 'electron', 'correct runtime')
    t.equal(rc.runtime, rc.r, 'runtime alias')
    t.equal(rc.abi, '50', 'correct ABI')
    t.equal(rc.token, 'TOKEN', 'correct token')
    t.equal(rc['tag-prefix'], 'v', 'correct default tag prefix')
    t.end()
  })
})

// TODO: merge into above test
test('npm args are passed on from npm environment into rc', function (t) {
  const args = [
    '--build-from-source',
    '--download',
    'https://foo.bar',
    '--debug',
    '--verbose'
  ].join(' ')

  runRc(t, args, {}, function (rc) {
    t.equal(rc.buildFromSource, true, 'buildFromSource should be true')
    t.equal(rc.debug, true, 'debug should be true')
    t.equal(rc.verbose, true, 'verbose should be true')
    t.equal(rc.download, 'https://foo.bar', 'download is set')
    t.end()
  })
})

test('npm_config_* are passed on from environment into rc', function (t) {
  const env = {
    // Note that these are validated by npm
    npm_config_proxy: 'http://localhost/',
    npm_config_https_proxy: 'https://localhost/',
    npm_config_local_address: '127.0.0.1',
    npm_config_target: '1.4.0',
    npm_config_runtime: 'electron',
    npm_config_platform: 'linux',
    npm_config_build_from_source: 'true',
    npm_config_libc: 'testlibc'
  }
  runRc(t, '', env, function (rc) {
    t.equal(rc.proxy, 'http://localhost/', 'proxy is set')
    t.equal(rc['https-proxy'], 'https://localhost/', 'https-proxy is set')
    t.equal(rc['local-address'], '127.0.0.1', 'local-address is set')
    t.equal(rc.target, '1.4.0', 'target is set')
    t.equal(rc.runtime, 'electron', 'runtime is set')
    t.equal(rc.platform, 'linux', 'platform is set')
    t.equal(rc.buildFromSource, true, 'build-from-source is set')
    t.equal(rc.libc, 'testlibc', 'libc is set')
    t.end()
  })
})

test('can pass in external package config to rc', function (t) {
  const pkg = {
    config: {
      target: '1.0.0',
      runtime: 'electron',
      arch: 'woohoo-arch'
    }
  }
  const rc = require('../rc')(pkg)
  t.equal(rc.target, '1.0.0', 'correct target')
  t.equal(rc.runtime, 'electron', 'correct runtime')
  t.equal(rc.arch, 'woohoo-arch', 'correct arch')
  t.end()
})

test('use default ABI', function (t) {
  runRc(t, '', {}, function (rc) {
    t.equal(rc.abi, process.versions.modules, 'correct default ABI')
    t.end()
  })
})

test('using --tag-prefix will set the tag prefix', function (t) {
  const args = ['--tag-prefix @scoped/package@']
  runRc(t, args.join(' '), {}, function (rc) {
    t.equal(rc['tag-prefix'], '@scoped/package@', 'tag prefix should be set')
    t.end()
  })
})

test('libc works on linux platform', function (t) {
  const args = [
    '--libc musl --platform linux'
  ]
  runRc(t, args.join(' '), {}, function (rc, tmp) {
    t.equal(rc.libc, 'musl', 'libc family')
    t.equal(rc.platform, 'linux', 'platform')
    t.end()
  })
})

test('libc glibc is passed as empty', function (t) {
  const args = [
    '--libc glibc --platform linux'
  ]
  runRc(t, args.join(' '), {}, function (rc, tmp) {
    t.equal(rc.libc, '', 'libc family')
    t.equal(rc.platform, 'linux', 'platform')
    t.end()
  })
})

test('libc is discarded on non-linux platform', function (t) {
  const args = [
    '--libc musl --platform windows'
  ]
  runRc(t, args.join(' '), {}, function (rc, tmp) {
    t.equal(rc.libc, '', 'libc family')
    t.equal(rc.platform, 'windows', 'platform')
    t.end()
  })
})

function runRc (t, args, env, cb) {
  const pkg = {
    name: 'test',
    private: true,
    scripts: {
      install: 'node ' + path.resolve(__dirname, '..', 'rc.js') + ' ' + args
    }
  }

  const tmp = tempy.directory()
  const json = JSON.stringify(pkg)

  fs.writeFile(path.join(tmp, 'package.json'), json, function (err) {
    if (err) throw err

    const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
    const cmd = npm + ' run install'

    env = Object.assign(cleanEnv(process.env), env)

    exec(cmd, { env, cwd: tmp }, function (err, stdout, stderr) {
      t.error(err, 'no error')
      t.equal(stderr.trim(), '', 'no stderr')

      let result

      try {
        result = JSON.parse(stdout.slice(stdout.indexOf('{')))
      } catch (e) {
        return t.fail(e)
      }

      cb(result, tmp)
    })
  })
}

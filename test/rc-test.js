var test = require('tape')
var path = require('path')
var exec = require('child_process').exec
var xtend = require('xtend')

test('custom config and aliases', function (t) {
  var args = [
    '--arch ARCH',
    '--platform PLATFORM',
    '--download https://foo.bar',
    '--debug',
    '--version',
    '--help',
    '--path ../some/other/path',
    '--target 1.4.10',
    '--runtime electron'
  ]
  runRc(t, args.join(' '), {}, function (rc) {
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
    t.equal(rc.path, '../some/other/path', 'correct path')
    t.equal(rc.path, rc.p, 'path alias')
    t.equal(rc.target, '1.4.10', 'correct target')
    t.equal(rc.target, rc.t, 'target alias')
    t.equal(rc.runtime, 'electron', 'correct runtime')
    t.equal(rc.runtime, rc.r, 'runtime alias')
    t.equal(rc.abi, '50', 'correct ABI')
    t.end()
  })
})

test('npm args are passed on from npm environment into rc', function (t) {
  var env = {
    npm_config_argv: JSON.stringify({
      cooked: [
        '--build-from-source',
        '--debug'
      ]
    })
  }
  runRc(t, '', env, function (rc) {
    t.equal(rc['build-from-source'], true, '--build-from-source works')
    t.equal(rc.compile, true, 'compile should be true')
    t.equal(rc.debug, true, 'debug should be true')
    t.end()
  })
})

test('npm_config_* are passed on from environment into rc', function (t) {
  var env = {
    npm_config_proxy: 'PROXY',
    npm_config_https_proxy: 'HTTPS_PROXY',
    npm_config_local_address: 'LOCAL_ADDRESS',
    npm_config_target: '1.4.0',
    npm_config_runtime: 'electron',
    npm_config_platform: 'PLATFORM'
  }
  runRc(t, '', env, function (rc) {
    t.equal(rc.proxy, 'PROXY', 'proxy is set')
    t.equal(rc['https-proxy'], 'HTTPS_PROXY', 'https-proxy is set')
    t.equal(rc['local-address'], 'LOCAL_ADDRESS', 'local-address is set')
    t.equal(rc.target, '1.4.0', 'target is set')
    t.equal(rc.runtime, 'electron', 'runtime is set')
    t.equal(rc.platform, 'PLATFORM', 'platform is set')
    t.end()
  })
})

test('can pass in external package config to rc', function (t) {
  var pkg = {
    config: {
      target: '1.0.0',
      runtime: 'electron',
      arch: 'woohoo-arch'
    }
  }
  var rc = require('../rc')(pkg)
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

function runRc (t, args, env, cb) {
  var cmd = 'node ' + path.resolve(__dirname, '..', 'rc.js') + ' ' + args
  env = xtend(process.env, env)
  exec(cmd, { env: env }, function (err, stdout, stderr) {
    t.error(err, 'no error')
    t.equal(stderr.length, 0, 'no stderr')
    var result
    try {
      result = JSON.parse(stdout.toString())
      t.pass('json parsed correctly')
    } catch (e) {
      t.fail(e.message)
    }
    cb(result)
  })
}

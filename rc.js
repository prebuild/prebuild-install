var minimist = require('minimist')
var getAbi = require('node-abi').getAbi

if (process.env.npm_config_argv) {
  var npmargs = ['prebuild', 'compile', 'build-from-source', 'debug']
  try {
    var npmArgv = JSON.parse(process.env.npm_config_argv).cooked
    for (var i = 0; i < npmargs.length; ++i) {
      if (npmArgv.indexOf('--' + npmargs[i]) !== -1) {
        process.argv.push('--' + npmargs[i])
      }
      if (npmArgv.indexOf('--no-' + npmargs[i]) !== -1) {
        process.argv.push('--no-' + npmargs[i])
      }
    }
  } catch (e) { }
}

var npmconfigs = ['proxy', 'https-proxy', 'local-address', 'target', 'runtime', 'platform']
for (var j = 0; j < npmconfigs.length; ++j) {
  var envname = 'npm_config_' + npmconfigs[j].replace('-', '_')
  if (process.env[envname]) {
    process.argv.push('--' + npmconfigs[j])
    process.argv.push(process.env[envname])
  }
}

module.exports = function (pkg) {
  var pkgConf = pkg.config || {}
  var rc = require('rc')('prebuild-install', {
    target: pkgConf.target || process.versions.node,
    runtime: pkgConf.runtime || 'node',
    arch: pkgConf.arch || process.env.npm_config_arch || process.arch,
    libc: process.env.LIBC,
    platform: process.platform,
    debug: false,
    verbose: false,
    prebuild: true,
    compile: false,
    path: '.',
    proxy: process.env['HTTP_PROXY'],
    'https-proxy': process.env['HTTPS_PROXY']
  }, minimist(process.argv, {
    alias: {
      target: 't',
      runtime: 'r',
      help: 'h',
      arch: 'a',
      path: 'p',
      version: 'v',
      download: 'd',
      'build-from-source': 'compile',
      compile: 'c'
    }
  }))

  if (rc.path === true) {
    delete rc.path
  }

  rc.abi = getAbi(rc.target, rc.runtime)

  return rc
}

if (!module.parent) {
  console.log(JSON.stringify(module.exports({}), null, 2))
}

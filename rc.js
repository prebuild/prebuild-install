var minimist = require('minimist')

if (process.env.npm_config_argv) {
  var npmargs = ['prebuild', 'debug']
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

var npmconfigs = ['proxy', 'https-proxy', 'local-address']
for (var j = 0; j < npmconfigs.length; ++j) {
  var envname = 'npm_config_' + npmconfigs[j].replace('-', '_')
  if (process.env[envname]) {
    process.argv.push('--' + npmconfigs[j])
    process.argv.push(process.env[envname])
  }
}

var rc = module.exports = require('rc')('prebuild-install', {
  target: process.env.npm_config_target || process.version,
  arch: process.env.npm_config_arch || process.arch,
  runtime: process.env.npm_config_runtime || process.title,
  platform: process.platform,
  abi: process.env.npm_config_abi || process.versions.modules,
  debug: false,
  verbose: false,
  prebuild: true,
  path: '.',
  proxy: process.env['HTTP_PROXY'],
  'https-proxy': process.env['HTTPS_PROXY']
}, minimist(process.argv, {
  alias: {
    target: 'b',
    arch: 'a',
    runtime: 'r',
    path: 'p',
    help: 'h',
    version: 'v',
    download: 'd'
  }
}))

if (rc.path === true) {
  delete rc.path
}

if (!module.parent) {
  console.log(JSON.stringify(module.exports, null, 2))
}

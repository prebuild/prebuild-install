#!/usr/bin/env node

var fs = require('fs')
var path = require('path')

var log = require('npmlog')
var extend = require('xtend')

var rc = require('./lib/rc')
var download = require('./lib/download')

var prebuildClientVersion = require('./package.json').version

if (rc.help) {
  console.error(fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf-8'))
  process.exit(0)
}

if (rc.version) {
  console.log(prebuildClientVersion)
  process.exit(0)
}

if (rc.prebuild === false) {
  log.info('setup', '`--no-prebuild` specified, not attempting download')
  process.exit(1)
}

if (rc.path) process.chdir(rc.path)

log.heading = 'prebuild-install'
if (rc.verbose) {
  log.level = 'verbose'
} else {
  var loglevel = process.env.npm_config_loglevel
  if (loglevel) log.level = loglevel
}

var pkg = path.resolve('package.json')
try {
  pkg = require(pkg)
} catch (e) {
  log.error('setup', 'No package.json found, aborting')
  process.exit(2)
}

log.info('begin', 'Prebuild-install version', prebuildClientVersion)

var opts = extend(rc, {pkg: pkg, log: log})

if (!pkg._from) {
  log.info('install', 'installing from project directory, skipping download')
  process.exit(3)
} else if (pkg._from.length > 4 && pkg._from.substr(0, 4) === 'git+') {
  log.info('install', 'installing from git repository, skipping download')
  process.exit(4)
}

download(opts, function (err) {
  if (err) {
    log.warn('install', err.message)
    return process.exit(5)
  }

  log.info('install', 'Prebuild successfully installed!')
})

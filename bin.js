#!/usr/bin/env node

var path = require('path')
var log = require('npmlog')
var fs = require('fs')
var extend = require('xtend')

var rc = require('./rc')
var download = require('./download')

var prebuildClientVersion = require('./package.json').version
if (rc.version) {
  console.log(prebuildClientVersion)
  process.exit(0)
}

if (rc.path) process.chdir(rc.path)

log.heading = 'prebuild-install'
if (rc.verbose) {
  log.level = 'verbose'
} else if (process.env.npm_config_loglevel) {
  log.level = process.env.npm_config_loglevel
}

if (!fs.existsSync('package.json')) {
  log.error('setup', 'No package.json found. Aborting...')
  process.exit(1)
}

var pkg = require(path.resolve(__dirname, '../..', 'package.json'))

if (rc.help) {
  console.error(fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf-8'))
  process.exit(0)
}

log.info('begin', 'Prebuild-install version', prebuildClientVersion)

var opts = extend(rc, {pkg: pkg, log: log})

if (opts.download) {
  if (typeof pkg._from !== 'string') {
    log.info('install', 'installing project from code source, skipping download.')
    process.exit(1)
  } else if (pkg._from.length > 4 && pkg._from.substr(0, 4) === 'git+') {
    log.info('install', 'installing from git repository, skipping download.')
    process.exit(1)
  }

  if (opts.prebuild === false) {
    log.info('install', '--no-prebuild specified, not attempting download.')
    process.exit(1)
  }

  download(opts, function (err) {
    if (err) {
      log.warn('install', err.message)
      return process.exit(1)
    }
    log.info('install', 'Prebuild successfully installed!')
  })
}

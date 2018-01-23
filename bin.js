#!/usr/bin/env node

const path = require('path')
const log = require('npmlog')
const fs = require('fs')

const pkg = require(path.resolve('package.json'))
const rc = require('./rc')(pkg)
const download = require('./download')
const util = require('./util')

const prebuildClientVersion = require('./package.json').version
if (rc.version) {
  console.log(prebuildClientVersion)
  process.exit(0)
}

if (rc.path) process.chdir(rc.path)

log.heading = 'prebuild-install'
if (rc.verbose) {
  log.level = 'verbose'
}

if (!fs.existsSync('package.json')) {
  log.error('setup', 'No package.json found. Aborting...')
  process.exit(1)
}

if (rc.help) {
  console.error(fs.readFileSync(path.join(__dirname, 'help.txt'), 'utf-8'))
  process.exit(0)
}

log.info('begin', 'Prebuild-install version', prebuildClientVersion)

const opts = Object.assign({}, rc, {pkg: pkg, log: log})

const execPath = process.env.npm_execpath || process.env.NPM_CLI_JS

if (util.isYarnPath(execPath) && /node_modules/.test(process.cwd())) {
  // From yarn repository
} else if (opts.force) {
  log.warn('install', 'prebuilt binaries enforced with --force!')
  log.warn('install', 'prebuilt binaries may be out of date!')
} else if (!(typeof pkg._from === 'string')) {
  log.info('install', 'installing standalone, skipping download.')
  process.exit(1)
} else if (pkg._from.length > 4 && pkg._from.substr(0, 4) === 'git+') {
  log.info('install', 'installing from git repository, skipping download.')
  process.exit(1)
} else if (opts.compile === true || opts.prebuild === false) {
  log.info('install', '--build-from-source specified, not attempting download.')
  process.exit(1)
}

download(opts, (err) => {
  if (err) {
    log.warn('install', err.message)
    return process.exit(1)
  }
  log.info('install', 'Successfully installed prebuilt binary!')
})

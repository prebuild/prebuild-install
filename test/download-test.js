const test = require('tape')
const fs = require('fs')
const rm = require('rimraf')
const path = require('path')
const http = require('http')
const https = require('https')
const download = require('../download')
const util = require('../util')
const error = require('../error')

const build = path.join(__dirname, 'build')
const unpacked = path.join(build, 'Release/leveldown.node')

test('downloading from GitHub, not cached', (t) => {
  t.plan(14)
  rm.sync(build)
  rm.sync(util.prebuildCache())

  const opts = getOpts()
  const downloadUrl = util.getDownloadUrl(opts)
  const cachedPrebuild = util.cachedPrebuild(downloadUrl)
  const npmCache = util.npmCache()
  var tempFile

  var accessCallNum = 0
  const _access = fs.access
  fs.access = (path, a, cb) => {
    if (!cb) cb = a
    if (accessCallNum++ === 0) {
      t.equal(path, npmCache, 'fs.access called for npm cache')
      _access(path, cb)
    } else {
      t.equal(path, cachedPrebuild, 'fs.access called for prebuild')
      _access(path, (err) => {
        t.ok(err, 'prebuild should be cached')
        cb(err)
      })
    }
  }

  var mkdirCount = 0
  const _mkdir = fs.mkdir.bind(fs)
  fs.mkdir = function () {
    const args = [].slice.call(arguments)
    if (mkdirCount++ === 0) {
      t.equal(args[0], util.prebuildCache(), 'fs.mkdir called for prebuildCache')
    }
    _mkdir.apply(fs, arguments)
  }

  var writeStreamCount = 0
  const _createWriteStream = fs.createWriteStream.bind(fs)
  fs.createWriteStream = (path) => {
    if (writeStreamCount++ === 0) {
      tempFile = path
      t.ok(/\.tmp$/i.test(path), 'this is the temporary file')
    } else {
      t.ok(/\.node$/i.test(path), 'this is the unpacked file')
    }
    return _createWriteStream(path)
  }

  const _createReadStream = fs.createReadStream.bind(fs)
  fs.createReadStream = (path) => {
    t.equal(path, cachedPrebuild, 'createReadStream called for cachedPrebuild')
    return _createReadStream(path)
  }

  const _request = https.request
  https.request = function (opts) {
    https.request = _request
    t.equal('https://' + opts.hostname + opts.path, downloadUrl, 'correct url')
    return _request.apply(https, arguments)
  }

  t.equal(fs.existsSync(build), false, 'no build folder')

  download(opts, (err) => {
    t.error(err, 'no error')
    t.equal(fs.existsSync(util.prebuildCache()), true, 'prebuildCache created')
    t.equal(fs.existsSync(cachedPrebuild), true, 'prebuild was cached')
    t.equal(fs.existsSync(unpacked), true, unpacked + ' should exist')
    t.equal(fs.existsSync(tempFile), false, 'temp file should be gone')
    fs.access = _access
    fs.mkdir = _mkdir
    fs.createWriteStream = _createWriteStream
    fs.createReadStream = _createReadStream
  })
})

test('cached prebuild', (t) => {
  t.plan(8)
  rm.sync(build)

  const opts = getOpts()
  const downloadUrl = util.getDownloadUrl(opts)
  const cachedPrebuild = util.cachedPrebuild(downloadUrl)
  const npmCache = util.npmCache()

  var accessCallNum = 0
  const _access = fs.access
  fs.access = (path, a, cb) => {
    if (!cb) cb = a
    if (accessCallNum++ === 0) {
      t.equal(path, npmCache, 'fs.access called for npm cache')
      _access(path, cb)
    } else {
      t.equal(path, cachedPrebuild, 'fs.access called for prebuild')
      _access(path, (err) => {
        t.notOk(err, 'prebuild should be cached')
        cb(err)
      })
    }
  }

  const _createWriteStream = fs.createWriteStream.bind(fs)
  fs.createWriteStream = (path) => {
    t.ok(/\.node$/i.test(path), 'this is the unpacked file')
    return _createWriteStream(path)
  }

  const _createReadStream = fs.createReadStream.bind(fs)
  fs.createReadStream = (path) => {
    t.equal(path, cachedPrebuild, 'createReadStream called for cachedPrebuild')
    return _createReadStream(path)
  }

  t.equal(fs.existsSync(build), false, 'no build folder')

  download(opts, (err) => {
    t.error(err, 'no error')
    t.equal(fs.existsSync(unpacked), true, unpacked + ' should exist')
    fs.createReadStream = _createReadStream
    fs.createWriteStream = _createWriteStream
    fs.access = _access
  })
})

test('non existing host should fail with no dangling temp file', (t) => {
  t.plan(3)

  const opts = getOpts()
  opts.pkg.binary = {
    host: 'https://foo.bar.baz'
  }

  const downloadUrl = util.getDownloadUrl(opts)
  const cachedPrebuild = util.cachedPrebuild(downloadUrl)

  const _createWriteStream = fs.createWriteStream.bind(fs)
  fs.createWriteStream = (path) => {
    t.ok(false, 'no temporary file should be written')
    return _createWriteStream(path)
  }

  t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')

  download(opts, (err) => {
    t.ok(err, 'should error')
    t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
    fs.createWriteStream = _createWriteStream
  })
})

test('existing host but invalid url should fail', (t) => {
  t.plan(3)

  const opts = getOpts()
  opts.pkg.binary = {
    host: 'http://localhost:8888',
    remote_path: 'prebuilds',
    package_name: 'woohooo-{abi}'
  }

  const downloadUrl = util.getDownloadUrl(opts)
  const cachedPrebuild = util.cachedPrebuild(downloadUrl)

  const server = http.createServer((req, res) => {
    t.equal(req.url, '/prebuilds/woohooo-' + process.versions.modules, 'correct url')
    res.statusCode = 404
    res.end()
  }).listen(8888, () => {
    download(opts, (err) => {
      t.same(err, error.noPrebuilts(opts))
      t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
      t.end()
      server.unref()
    })
  })
})

test('error during download should fail with no dangling temp file', (t) => {
  t.plan(7)

  const downloadError = new Error('something went wrong during download')

  const opts = getOpts()
  opts.pkg.binary = {
    host: 'http://localhost:8889',
    remote_path: 'prebuilds',
    package_name: 'woohooo-{abi}'
  }

  const downloadUrl = util.getDownloadUrl(opts)
  const cachedPrebuild = util.cachedPrebuild(downloadUrl)
  var tempFile

  const _createWriteStream = fs.createWriteStream.bind(fs)
  fs.createWriteStream = (path) => {
    tempFile = path
    t.ok(/\.tmp$/i.test(path), 'this is the temporary file')
    return _createWriteStream(path)
  }

  const _request = http.request
  http.request = function (opts) {
    http.request = _request
    t.equal('http://' + opts.hostname + ':' + opts.port + opts.path, downloadUrl, 'correct url')
    const wrapped = arguments[1]
    arguments[1] = (res) => {
      t.equal(res.statusCode, 200, 'correct statusCode')
      // simulates error during download
      setTimeout(() => { res.emit('error', downloadError) }, 10)
      wrapped(res)
    }
    return _request.apply(http, arguments)
  }

  const server = http.createServer((req, res) => {
    t.equal(req.url, '/prebuilds/woohooo-' + process.versions.modules, 'correct url')
    res.statusCode = 200
    res.write('yep') // simulates hanging request
  }).listen(8889, () => {
    download(opts, (err) => {
      t.equal(err.message, downloadError.message, 'correct error')
      t.equal(fs.existsSync(tempFile), false, 'no dangling temp file')
      t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
      t.end()
      fs.createWriteStream = _createWriteStream
      server.unref()
    })
  })
})

test('should fail if abi is system abi with invalid binary', (t) => {
  const opts = getOpts()
  opts.abi = process.versions.modules
  opts.pkg.binary = {host: 'http://localhost:8890'}

  const server = http.createServer((req, res) => {
    res.statusCode = 200
    const archive = path.join(__dirname, 'invalid.tar.gz')
    fs.createReadStream(archive).pipe(res)
  }).listen(8890, () => {
    download(opts, (err) => {
      server.unref()
      if (err && typeof err.message === 'string') {
        t.pass('require failed because of invalid abi')
      } else {
        t.fail('should have caused a require() error')
      }
      t.end()
    })
  })
})

function getOpts () {
  return {
    pkg: require('a-native-module/package'),
    nolocal: true,
    platform: process.platform,
    arch: process.arch,
    path: __dirname
  }
}

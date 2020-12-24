var test = require('tape')
var fs = require('fs')
var rm = require('rimraf')
var path = require('path')
var http = require('http')
var https = require('https')
var download = require('../download')
var util = require('../util')
var error = require('../error')

var build = path.join(__dirname, 'build')
var unpacked = path.join(build, 'Release/leveldown.node')

test('downloading from GitHub, not cached', function (t) {
  t.plan(10)
  rm.sync(build)
  rm.sync(util.prebuildCache())

  var opts = getOpts()
  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)
  var tempFile

  var writeStreamCount = 0
  var _createWriteStream = fs.createWriteStream
  fs.createWriteStream = function (path) {
    if (writeStreamCount++ === 0) {
      tempFile = path
      t.ok(/\.tmp$/i.test(path), 'this is the temporary file')
    } else {
      t.ok(/\.node$/i.test(path), 'this is the unpacked file')
    }
    return _createWriteStream(path)
  }

  var _createReadStream = fs.createReadStream
  fs.createReadStream = function (path) {
    t.equal(path, cachedPrebuild, 'createReadStream called for cachedPrebuild')
    return _createReadStream(path)
  }

  var _request = https.request
  https.request = function (opts) {
    https.request = _request
    t.equal('https://' + opts.hostname + opts.path, downloadUrl, 'correct url')
    return _request.apply(https, arguments)
  }

  t.equal(fs.existsSync(build), false, 'no build folder')

  download(downloadUrl, opts, function (err) {
    t.error(err, 'no error')
    t.equal(fs.existsSync(util.prebuildCache()), true, 'prebuildCache created')
    t.equal(fs.existsSync(cachedPrebuild), true, 'prebuild was cached')
    t.equal(fs.existsSync(unpacked), true, unpacked + ' should exist')
    t.equal(fs.existsSync(tempFile), false, 'temp file should be gone')
    fs.createWriteStream = _createWriteStream
    fs.createReadStream = _createReadStream
  })
})

test('cached prebuild', function (t) {
  t.plan(5)
  rm.sync(build)

  var opts = getOpts()
  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)

  var _createWriteStream = fs.createWriteStream
  fs.createWriteStream = function (path) {
    t.ok(/\.node$/i.test(path), 'this is the unpacked file')
    return _createWriteStream(path)
  }

  var _createReadStream = fs.createReadStream
  fs.createReadStream = function (path) {
    t.equal(path, cachedPrebuild, 'createReadStream called for cachedPrebuild')
    return _createReadStream(path)
  }

  t.equal(fs.existsSync(build), false, 'no build folder')

  download(downloadUrl, opts, function (err) {
    t.error(err, 'no error')
    t.equal(fs.existsSync(unpacked), true, unpacked + ' should exist')
    fs.createReadStream = _createReadStream
    fs.createWriteStream = _createWriteStream
  })
})

test('local prebuild', function (t) {
  t.plan(6)
  rm.sync(build)

  var opts = getOpts()
  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)
  var localPrebuild = util.localPrebuild(downloadUrl, opts)

  t.ok(fs.existsSync(cachedPrebuild), 'cached prebuild exists')

  // fs.copyFileSync() not available before Node 8.5
  fs.writeFileSync(localPrebuild, fs.readFileSync(cachedPrebuild))

  var _createWriteStream = fs.createWriteStream
  fs.createWriteStream = function (path) {
    t.ok(/\.node$/i.test(path), 'this is the unpacked file')
    return _createWriteStream(path)
  }

  var _createReadStream = fs.createReadStream
  fs.createReadStream = function (path) {
    t.equal(path, localPrebuild, 'createReadStream called for localPrebuild')
    return _createReadStream(path)
  }

  t.equal(fs.existsSync(build), false, 'no build folder')

  download(downloadUrl, opts, function (err) {
    t.error(err, 'no error')
    t.equal(fs.existsSync(unpacked), true, unpacked + ' should exist')
    fs.createReadStream = _createReadStream
    fs.createWriteStream = _createWriteStream
    rm.sync(localPrebuild)
  })
})

test('non existing host should fail with no dangling temp file', function (t) {
  t.plan(3)

  var opts = getOpts()
  opts.pkg.binary = {
    host: 'https://foo.bar.baz'
  }

  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)

  var _createWriteStream = fs.createWriteStream
  fs.createWriteStream = function (path) {
    t.ok(false, 'no temporary file should be written')
    return _createWriteStream(path)
  }

  t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')

  download(downloadUrl, opts, function (err) {
    t.ok(err, 'should error')
    t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
    fs.createWriteStream = _createWriteStream
  })
})

test('existing host but invalid url should fail', function (t) {
  t.plan(3)

  var opts = getOpts()
  opts.pkg.binary = {
    host: 'http://localhost:8888',
    remote_path: 'prebuilds',
    package_name: 'woohooo-{abi}'
  }

  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)

  var server = http.createServer(function (req, res) {
    t.equal(req.url, '/prebuilds/woohooo-' + opts.abi, 'correct url')
    res.statusCode = 404
    res.end()
  }).listen(8888, function () {
    download(downloadUrl, opts, function (err) {
      t.same(err, error.noPrebuilts(opts))
      t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
      t.end()
      server.unref()
    })
  })
})

test('error during download should fail with no dangling temp file', function (t) {
  t.plan(7)

  var downloadError = new Error('something went wrong during download')

  var opts = getOpts()
  opts.pkg.binary = {
    host: 'http://localhost:8889',
    remote_path: 'prebuilds',
    package_name: 'woohooo-{abi}'
  }

  var downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)
  var tempFile

  var _createWriteStream = fs.createWriteStream
  fs.createWriteStream = function (path) {
    tempFile = path
    t.ok(/\.tmp$/i.test(path), 'this is the temporary file')
    return _createWriteStream(path)
  }

  var _request = http.request
  http.request = function (opts) {
    http.request = _request
    t.equal('http://' + opts.hostname + ':' + opts.port + opts.path, downloadUrl, 'correct url')
    var wrapped = arguments[1]
    arguments[1] = function (res) {
      t.equal(res.statusCode, 200, 'correct statusCode')
      // simulates error during download
      setTimeout(function () { res.emit('error', downloadError) }, 10)
      wrapped(res)
    }
    return _request.apply(http, arguments)
  }

  var server = http.createServer(function (req, res) {
    t.equal(req.url, '/prebuilds/woohooo-' + opts.abi, 'correct url')
    res.statusCode = 200
    res.write('yep') // simulates hanging request
  }).listen(8889, function () {
    download(downloadUrl, opts, function (err) {
      t.equal(err.message, downloadError.message, 'correct error')
      t.equal(fs.existsSync(tempFile), false, 'no dangling temp file')
      t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
      t.end()
      fs.createWriteStream = _createWriteStream
      server.unref()
    })
  })
})

test('should fail if abi is system abi with invalid binary', function (t) {
  var opts = getOpts()
  opts.abi = process.versions.modules
  opts.pkg.binary = { host: 'http://localhost:8890' }

  var server = http.createServer(function (req, res) {
    res.statusCode = 200
    var archive = path.join(__dirname, 'invalid.tar.gz')
    fs.createReadStream(archive).pipe(res)
  }).listen(8890, function () {
    download(util.getDownloadUrl(opts), opts, function (err) {
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
    runtime: 'node',
    abi: 64,
    platform: process.platform,
    arch: process.arch,
    path: __dirname,
    'tag-prefix': 'v',
    'local-prebuilds': __dirname
  }
}

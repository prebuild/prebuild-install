var test = require('tape')
var fs = require('fs')
var rm = require('rimraf')
var path = require('path')
var https = require('https')
var download = require('../download')
var util = require('../util')
var asset = require('../asset')
var nock = require('nock')
var releases = require('./releases.json')

var build = path.join(__dirname, 'build')
var unpacked = path.join(build, 'Release/leveldown.node')

// Release assets call
nock('https://api.github.com:443', {
  encodedQueryParams: true,
  reqheaders: {
    'User-Agent': 'simple-get',
    Authorization: 'token TOKEN'
  }
})
  .persist()
  .get('/repos/ralphtheninja/a-native-module/releases')
  .reply(200, releases)

// Binary download
nock('https://api.github.com:443', {
  encodedQueryParams: true,
  reqheaders: {
    'User-Agent': 'simple-get'
  }
})
  .persist()
  .get(function (uri) {
    return /\/repos\/ralphtheninja\/a-native-module\/releases\/assets\/\d*\?access_token=TOKEN/g.test(uri)
  })
  .reply(302, undefined, {
    Location: function (req, res, body) {
      var assetId = req.path
          .replace('/repos/ralphtheninja/a-native-module/releases/assets/', '')
          .replace('?access_token=TOKEN', '')

      for (var release of releases) {
        for (var asset of release.assets) {
          if (asset.id.toString() === assetId) {
            return asset.browser_download_url
          }
        }
      }
    }
  })

test('downloading from GitHub with token', function (t) {
  t.plan(11)
  rm.sync(build)
  rm.sync(util.prebuildCache())

  var opts = getOpts()
  asset(opts, function (err, assetId) {
    t.error(err, 'no error')

    var downloadUrl = util.getAssetUrl(opts, assetId)
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
    https.request = function (req) {
      https.request = _request
      t.equal('https://' + req.hostname + req.path, downloadUrl + '?access_token=' + opts.token, 'correct url')
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
})

test('non existing version should fail asset request', function (t) {
  t.plan(3)
  rm.sync(build)
  rm.sync(util.prebuildCache())

  var opts = getOpts()
  opts.pkg = Object.assign({}, opts.pkg, { version: '0' })
  asset(opts, function (err, assetId) {
    t.ok(err, 'should error')
    t.equal(assetId, undefined)

    var downloadUrl = util.getAssetUrl(opts, assetId)
    var cachedPrebuild = util.cachedPrebuild(downloadUrl)

    t.equal(fs.existsSync(cachedPrebuild), false, 'nothing cached')
  })
})

function getOpts () {
  return {
    pkg: require('a-native-module/package'),
    runtime: 'node',
    platform: process.platform,
    arch: process.arch,
    path: __dirname,
    token: 'TOKEN',
    'tag-prefix': 'v'
  }
}

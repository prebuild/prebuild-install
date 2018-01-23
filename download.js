const path = require('path')
const fs = require('fs')
const get = require('simple-get')
const pump = require('pump')
const tfs = require('tar-fs')
const noop = Object.assign({
  http: function () {},
  silly: function () {}
}, require('noop-logger'))
const zlib = require('zlib')
const util = require('./util')
const error = require('./error')
const url = require('url')
const tunnel = require('tunnel-agent')
const mkdirp = require('mkdirp')

function downloadPrebuild (opts, cb) {
  const downloadUrl = util.getDownloadUrl(opts)
  var cachedPrebuild = util.cachedPrebuild(downloadUrl)
  const localPrebuild = util.localPrebuild(downloadUrl)
  const tempFile = util.tempFile(cachedPrebuild)

  const log = opts.log || noop

  if (opts.nolocal) return download()

  log.info('looking for local prebuild @', localPrebuild)
  util.exists(localPrebuild, (exists) => {
    if (exists) {
      log.info('found local prebuild')
      cachedPrebuild = localPrebuild
      return unpack()
    }

    download()
  })

  function download () {
    ensureNpmCacheDir((err) => {
      if (err) return onerror(err)

      log.info('looking for cached prebuild @', cachedPrebuild)
      util.exists(cachedPrebuild, (exists) => {
        if (exists) {
          log.info('found cached prebuild')
          return unpack()
        }

        log.http('request', 'GET ' + downloadUrl)
        const reqOpts = { url: downloadUrl }
        const proxy = opts['https-proxy'] || opts.proxy

        if (proxy) {
          const parsedDownloadUrl = url.parse(downloadUrl)
          const parsedProxy = url.parse(proxy)
          const uriProtocol = (parsedDownloadUrl.protocol === 'https:' ? 'https' : 'http')
          const proxyProtocol = (parsedProxy.protocol === 'https:' ? 'Https' : 'Http')
          const tunnelFnName = [uriProtocol, proxyProtocol].join('Over')
          reqOpts.agent = tunnel[tunnelFnName]({
            proxy: {
              host: parsedProxy.hostname,
              port: +parsedProxy.port,
              proxyAuth: parsedProxy.auth
            }
          })
          log.http('request', 'Proxy setup detected (Host: ' +
            parsedProxy.hostname + ', Port: ' +
            parsedProxy.port + ', Authentication: ' +
            (parsedProxy.auth ? 'Yes' : 'No') + ')' +
            ' Tunneling with ' + tunnelFnName)
        }

        const req = get(reqOpts, (err, res) => {
          if (err) return onerror(err)
          log.http(res.statusCode, downloadUrl)
          if (res.statusCode !== 200) return onerror()
          mkdirp(util.prebuildCache(), () => {
            log.info('downloading to @', tempFile)
            pump(res, fs.createWriteStream(tempFile), (err) => {
              if (err) return onerror(err)
              fs.rename(tempFile, cachedPrebuild, (err) => {
                if (err) return cb(err)
                log.info('renaming to @', cachedPrebuild)
                unpack()
              })
            })
          })
        })

        req.setTimeout(30 * 1000, () => {
          req.abort()
        })
      })

      function onerror (err) {
        fs.unlink(tempFile, () => {
          cb(err || error.noPrebuilts(opts))
        })
      }
    })
  }

  function unpack () {
    var binaryName

    const updateName = opts.updateName || function (entry) {
      if (/\.node$/i.test(entry.name)) binaryName = entry.name
    }

    log.info('unpacking @', cachedPrebuild)

    const options = {
      readable: true,
      writable: true,
      hardlinkAsFilesFallback: true
    }
    const extract = tfs.extract(opts.path, options).on('entry', updateName)

    pump(fs.createReadStream(cachedPrebuild), zlib.createGunzip(), extract,
    (err) => {
      if (err) return cb(err)

      var resolved
      if (binaryName) {
        try {
          resolved = path.resolve(opts.path || '.', binaryName)
        } catch (err) {
          return cb(err)
        }
        log.info('unpack', 'resolved to ' + resolved)

        if (opts.platform === process.platform && opts.abi === process.versions.modules) {
          try {
            require(resolved)
          } catch (err) {
            return cb(err)
          }
          log.info('unpack', 'required ' + resolved + ' successfully')
        }
      }

      cb(null, resolved)
    })
  }

  function ensureNpmCacheDir (cb) {
    const cacheFolder = util.npmCache()
    fs.access(cacheFolder, fs.R_OK | fs.W_OK, (err) => {
      if (err && err.code === 'ENOENT') {
        return makeNpmCacheDir()
      }
      cb(err)
    })

    function makeNpmCacheDir () {
      log.info('npm cache directory missing, creating it...')
      mkdirp(cacheFolder, cb)
    }
  }
}

module.exports = downloadPrebuild

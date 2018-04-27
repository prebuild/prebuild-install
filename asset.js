var get = require('simple-get')
var noop = Object.assign({
  http: function () {},
  silly: function () {}
}, require('noop-logger'))
var util = require('./util')
var url = require('url')
var tunnel = require('tunnel-agent')

function findAssetId (opts, cb) {

  var downloadUrl = util.getDownloadUrl(opts)
  var apiUrl = util.getApiUrl(opts)
  var log = opts.log || noop

  log.http('request', 'GET ' + apiUrl)
  var reqOpts = { url: apiUrl, json: true }
  var proxy = opts['https-proxy'] || opts.proxy

  reqOpts.headers = {
    'User-Agent': 'simple-get'
  }
  if (opts.token) {
    reqOpts.headers.Authorization = 'token ' + opts.token
  }

  if (proxy) {
    var parsedDownloadUrl = url.parse(apiUrl)
    var parsedProxy = url.parse(proxy)
    var uriProtocol = (parsedDownloadUrl.protocol === 'https:' ? 'https' : 'http')
    var proxyProtocol = (parsedProxy.protocol === 'https:' ? 'Https' : 'Http')
    var tunnelFnName = [uriProtocol, proxyProtocol].join('Over')
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

  var req = get.concat(reqOpts, function (err, res, data) {
    if (err) return cb(err)
    log.http(res.statusCode, apiUrl)
    if (res.statusCode !== 200) return cb(err)

    // Find asset id in release
    for (var release of data) {
      if (release.tag_name === 'v' + opts.pkg.version) {
        for (var asset of release.assets) {
          if (asset.browser_download_url === downloadUrl) {
            return cb(null, asset.id)
          }
        }
      }

      throw new Error('Could not find GitHub release for version')
    }
  })

  req.setTimeout(30 * 1000, function () {
    req.abort()
  })
}

module.exports = findAssetId

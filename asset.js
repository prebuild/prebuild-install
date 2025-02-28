const get = require('simple-get')
const util = require('./util')
const proxy = require('./proxy')

function findAssetId (opts, cb) {
  const downloadUrl = util.getDownloadUrl(opts)
  const apiUrl = util.getApiUrl(opts)
  const log = opts.log || util.noopLogger
  const maxPages = 10

  const checkReleasePage = function (page) {
    const reqOpts = proxy({
      url: apiUrl + '?page=' + page,
      json: true,
      headers: {
        'User-Agent': 'simple-get',
        Authorization: 'token ' + opts.token
      }
    }, opts)

    log.http('request', 'GET ' + reqOpts.url)
    const req = get.concat(reqOpts, function (err, res, data) {
      if (err) return cb(err)
      log.http(res.statusCode, apiUrl)
      if (res.statusCode !== 200) return cb(err)

      // Find asset id in release
      for (const release of data) {
        if (release.tag_name === opts['tag-prefix'] + opts.pkg.version) {
          for (const asset of release.assets) {
            if (asset.browser_download_url === downloadUrl) {
              return cb(null, asset.id)
            }
          }
        }
      }

      if (page >= maxPages) {
        cb(new Error('Could not find GitHub release for version'))
      } else {
        return checkReleasePage(page + 1)
      }
    })

    req.setTimeout(30 * 1000, function () {
      req.abort()
    })
  }

  checkReleasePage(1)
}

module.exports = findAssetId

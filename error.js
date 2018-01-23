exports.noPrebuilts = (opts) => {
  return new Error([
    'No prebuilt binaries found',
    '(target=' + opts.target,
    'runtime=' + opts.runtime,
    'arch=' + opts.arch,
    'platform=' + opts.platform + ')'
  ].join(' '))
}

exports.invalidArchive = () => {
  return new Error('Missing .node file in archive')
}

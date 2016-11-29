# prebuild-install [![Build Status](https://travis-ci.org/mafintosh/prebuild-install.svg?branch=master)](https://travis-ci.org/mafintosh/prebuild-install)

Command line tool to easily install prebuilds for multiple version of node/iojs

`prebuild-install` supports installing prebuilt binaries from GitHub by default

## Usage

Change your `package.json` `install` script to:
```json
...
  "scripts": {
    "install": "prebuild-install -d || node-gyp rebuild"
  }
...
```

### Requirements

You need to provide prebuilds made by [prebuild](https://github.com/mafintosh/prebuild)

### Help
```
prebuild-install [options]

  --download    -d  [url]       (download prebuilds, no url means github)
  --no-prebuild                 (skip prebuild download)
  --path        -p  path        (make a prebuild-install here)
  --debug                       (set Debug or Release configuration)
  --verbose                     (log verbosely)
  --version                     (print prebuild-install version and exit)
```

## License

MIT

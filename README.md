# webpack-reload-extension
Webpack plugin that auto reloads chrome extensions.

## Installation
```Shell
$ npm i -D webpack-reload-extension
```

## Usage
You need a content script and a background script for this plugin to work.

Only works when `mode` is set to `development`.

#### Options
| Option | Description | Default
| --- | --- | --- |
backgroundScript | The name of your background script | `background`
contentScript | The name of your content script | `content`
reloadPage | Should the content script reload their page | `true`

#### Example
```JavaScript
const path = require('path')
const ExtensionReloader = require('../webpack-reload-extension')

module.exports = {
  mode: process.env.NODE_ENV,
  entry: {
    content: './content.js',
    background: './background.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js'
  },
  plugins: [
    new ExtensionReloader({
      backgroundScript: 'background',
      contentScript: 'content',
      reloadPage: true
    })
  ]
}
```

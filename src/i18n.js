// Copyright (c) 2018 Claus Jørgensen
'use strict'

const path = require('path')
const electron = require('electron')
const fs = require('fs')
const util = require('util')

let loadedLanguage
let app = electron.app ? electron.app : electron.remote.app

function i18n () {
  if (loadedLanguage) {
    return
  }

  if (fs.existsSync(path.join(__dirname, '../locales', app.getLocale() + '.js'))) {
    loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', app.getLocale() + '.json'), 'utf8'))
  } else {
    loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', 'en.json'), 'utf8'))
  }
}

i18n.prototype.__ = function (phrase, ...args) {
  let translation = loadedLanguage[phrase]
  if (translation === undefined) {
    translation = phrase
  }
  return util.format(translation, ...args)
}

module.exports = i18n

// Copyright (c) 2018 Claus Jørgensen
'use strict'

const path = require('path')
const electron = require('electron')
const fs = require('fs')
const util = require('util')

let translations
let app = electron.app ? electron.app : electron.remote.app

module.exports = function (string, ...args) {
  if (!translations) {
    if (fs.existsSync(path.join(__dirname, '../locales', app.getLocale() + '.js'))) {
      translations = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', app.getLocale() + '.json'), 'utf8'))
    } else {
      translations = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', 'en.json'), 'utf8'))
    }
  }

  let translation = translations[string]
  if (translation === undefined) {
    translation = string
  }

  return util.format(translation, ...args)
}


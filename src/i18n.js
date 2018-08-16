// Copyright (c) 2018 Claus Jørgensen
'use strict'

const path = require('path')
const electron = require('electron')
const fs = require('fs')
const util = require('util')

let translations
let app = electron.app ? electron.app : electron.remote.app

// eslint-disable-next-line no-unused-vars
function pseudoLocalization (input) {
  var output = input
  var normal = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
  var pseudo = 'αḅͼḍḛϝḡḥḭĵḳḽṃṇṓṗʠṛṡṭṵṽẁẋẏẓḀḂḈḌḚḞḠḤḬĴḰḺṀṄṎṔǪṚṢṪṲṾŴẊŶŻ'
  for (var i = 0; i < normal.length; i++) {
    output = output.replace(normal[i], pseudo[i])
  }
  var expansionFactor = 1.0
  if (output.length < 11) {
    expansionFactor = 3
  } else if (output.length < 21) {
    expansionFactor = 2
  } else if (output.length < 31) {
    expansionFactor = 1.8
  } else if (output.length < 51) {
    expansionFactor = 1.6
  } else if (output.length < 71) {
    expansionFactor = 1.4
  } else {
    expansionFactor = 1.0
  }
  var expansion = '+'.repeat(output.length * expansionFactor - 2)
  output = '[' + output + expansion + ']'
  return output
}

module.exports = function (string, ...args) {
  if (!translations) {
    if (fs.existsSync(path.join(__dirname, '../locales', app.getLocale() + '.json'))) {
      translations = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', app.getLocale() + '.json'), 'utf8'))
    } else {
      translations = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales', 'en.json'), 'utf8'))
    }
  }

  let translation = translations[string]
  if (translation === undefined) {
    translation = string
  }

  let translated = util.format(translation, ...args)
  return translated
}

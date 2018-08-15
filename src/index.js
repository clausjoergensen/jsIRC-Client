// Copyright (c) 2018 Claus Jørgensen
'use strict'

const IrcViewController = require('./IrcViewController.js')
const inputhistory = require('./inputhistory.js')
const $ = require('jquery')

let viewController = null // eslint-disable-line no-unused-vars
let client = null // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', function (event) {
  viewController = new IrcViewController()
  inputhistory($("#chat-input"))
})

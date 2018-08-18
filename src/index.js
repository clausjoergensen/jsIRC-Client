// Copyright (c) 2018 Claus Jørgensen
'use strict'

const IrcViewController = require('./IrcViewController.js')

let viewController = null // eslint-disable-line no-unused-vars
let client = null // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', function (event) {
  viewController = new IrcViewController()
})

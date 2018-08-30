// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const IrcViewController = require('./IrcViewController.js')

let viewController = null // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', function (event) {
  viewController = new IrcViewController()
})

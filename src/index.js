// Copyright (c) 2018 Claus Jørgensen
'use strict'

const IrcViewController = require('./IrcViewController.js')

let viewController = null // eslint-disable-line no-unused-vars
let client = null // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', function (event) {
  viewController = new IrcViewController()

  viewController.connectToServer('localhost', 6667, {
    'nickName': 'Archchancellor',
    'userName': 'mustrum.ridcully@uu.edu',
    'realName': 'Mustrum Ridcully',
    'userModes': []
  })

  /*viewController.connectToServer('localhost', 6667, {
    'nickName': 'Bursar',
    'userName': 'bursar@uu.edu',
    'realName': 'A. A. Dimwiddle',
    'userModes': []
  })*/
})

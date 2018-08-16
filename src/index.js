// Copyright (c) 2018 Claus Jørgensen
'use strict'

const IrcViewController = require('./IrcViewController.js')

let viewController = null // eslint-disable-line no-unused-vars
let client = null // eslint-disable-line no-unused-vars

document.addEventListener('DOMContentLoaded', function (event) {
  viewController = new IrcViewController()
  // hax
  viewController.connectToServer('localhost', 6667, {
    nickName: 'Twoflower',
    userName: 'Twoflower',
    realName: 'Twoflower',
    userModes: []
  })
  let clientId = Object.keys(viewController.chatListViewController.connections)[0]
  let client = viewController.chatListViewController.connections[clientId].client
  client.once('registered', () => {
    client.joinChannel('#testing')
  })
  // hax
})

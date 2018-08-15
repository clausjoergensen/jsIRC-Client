// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { IrcClient, IrcFloodPreventer } = require('jsIRC')

const IrcNetworkListViewController = require('./IrcNetworkListViewController.js')
const IrcChatListViewController = require('./IrcChatListViewController.js')

const $ = require('jquery')

class IrcViewController {
  constructor () {
    this.networkListViewController = new IrcNetworkListViewController()
    this.chatListViewController = new IrcChatListViewController()

    $('#btn-add-server').on('click', e => {
      this.displayServerConnectionManager()
    })

    $(document).ready(() => {
      this.displayServerConnectionManager()
    })
    })*/
  }

  connectToServer (server, port, registrationInfo) {
    let client = new IrcClient()
    client.floodPreventer = new IrcFloodPreventer(4, 2000)

    this.chatListViewController.addServer(client)
    this.chatListViewController.on('chatWithUser', (client, user) => {
      this.networkListViewController.addUser(client, user)      
    })

    this.networkListViewController.addServer(client)
    this.networkListViewController.once('quit', (client) => {
      this.chatListViewController.quitServer(client)
    })
    this.networkListViewController.on('viewChannel', (client, channel) => {
      this.chatListViewController.viewChannel(client, channel)
    })
    this.networkListViewController.on('viewServer', (client) => {
      this.chatListViewController.viewServer(client)
    })
    this.networkListViewController.on('viewUser', (client, user) => {
      this.chatListViewController.viewUser(client, user)
    })
    this.networkListViewController.on('hideUser', (client, user) => {
      this.chatListViewController.hideUser(client, user)
    })

    client.connect(server, port, registrationInfo)

    this.networkListViewController.viewNextChannel()
  }

  displayServerConnectionManager () {
    // "Window"
    let inlineWindow = $('<div />', { 'id': 'connect-to-server-prompt', 'class': 'prompt-window' }).appendTo('body')

    // Title
    $('<div />', {
      'class': 'prompt-title',
      'text': 'Connect to new server'
    }).append(
      $('<span />', {
        'class': 'close',
        'click': () => inlineWindow.remove()
      })
    ).appendTo(inlineWindow)

    // Container
    let innerView = $('<div />', { 'style': 'padding: 10px' }).appendTo(inlineWindow)

    // Input Fields
    $('<div />', { 'text': 'Address' }).appendTo(innerView)

    let submit = () => {
      this.connectToServer(server.val(), parseInt(port.val()), {
        'nickName': nickName.val(),
        'userName': email.val(),
        'realName': realName.val(),
        'userModes': []
      })
      inlineWindow.remove()
    }

    let server = $('<input />', {
      'type': 'text',
      'style': '',
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': 'Port' }).appendTo(innerView)

    let port = $('<input />', {
      'type': 'text',
      'style': '',
      'onEnter': submit
    }).appendTo(innerView)

    port.val('6667')

    $('<div />', { 'text': 'Nickname' }).appendTo(innerView)

    let nickName = $('<input />', {
      'type': 'text',
      'style': '',
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': 'Name' }).appendTo(innerView)

    let realName = $('<input />', {
      'type': 'text',
      'style': '',
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': 'Email' }).appendTo(innerView)

    let email = $('<input />', {
      'type': 'text',
      'style': '',
      'onEnter': submit
    }).appendTo(innerView)

    $('<button />', {
      'text': 'Connect',
      'type': 'submit',
      'click': submit
    }).appendTo(innerView)

    // Close the Window on Esc
    let handler = null
    handler = (e) => {
      if ((e.which || e.keyCode) === 27) {
        window.removeEventListener('keyup', handler)
        inlineWindow.remove()
      }
    }
    window.addEventListener('keyup', handler)

    server.focus()
  }
}

module.exports = IrcViewController

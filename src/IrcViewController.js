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
  }

  connectToServer (server, port, registrationInfo) {
    let client = new IrcClient()
    client.floodPreventer = new IrcFloodPreventer(4, 2000)

    this.chatListViewController.addServer(client)

    this.networkListViewController.addServer(client)
    this.networkListViewController.on('viewChannel', (client, channel) => {
      this.chatListViewController.viewChannel(client, channel)
    })
    this.networkListViewController.on('viewServer', (client, serverName) => {
      this.chatListViewController.viewServer(client, serverName)
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

    $('<div />', { 'text': 'Address' }).appendTo(innerView)

    let server = $('<input />', {
      'type': 'text',
      'style': ''
    }).appendTo(innerView)

    $('<div />', { 'text': 'Port' }).appendTo(innerView)

    let port = $('<input />', {
      'type': 'text',
      'style': ''
    }).appendTo(innerView)

    port.val('6667')

    $('<div />', { 'text': 'Nickname' }).appendTo(innerView)

    let nickName = $('<input />', {
      'type': 'text',
      'style': ''
    }).appendTo(innerView)

    $('<div />', { 'text': 'Name' }).appendTo(innerView)

    let realName = $('<input />', {
      'type': 'text',
      'style': ''
    }).appendTo(innerView)

    $('<div />', { 'text': 'Email' }).appendTo(innerView)

    let email = $('<input />', {
      'type': 'text',      
      'style': ''
    }).appendTo(innerView)

    $('<button />', {
      'text': 'Connect',
      'type': 'submit',
      'click': (e) => {
        this.connectToServer(server.val(), parseInt(port.val()), {
          'nickName': nickName.val(),
          'userName': email.val(),
          'realName': realName.val(),
          'userModes': []
        })
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    server.val('localhost')
    nickName.val('Windcape')
    email.val('claus.joergensen@outlook.com')
    realName.val('Claus Jørgensen')

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

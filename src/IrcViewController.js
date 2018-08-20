// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const { remote, ipcRenderer } = require('electron')

const { IrcClient, IrcFloodPreventer } = require('jsirc')

const IrcNetworkListViewController = require('./IrcNetworkListViewController.js')
const IrcChatListViewController = require('./IrcChatListViewController.js')

const path = require('path')
const isPackaged = remote.app.isPackaged
const __ = require('./i18n.js')
const $ = require('jquery')

const Store = require('electron-store')
const store = new Store()

require('./IrcBroadcaster.js')

class IrcViewController {
  constructor () {
    this.networkListViewController = new IrcNetworkListViewController()
    this.chatListViewController = new IrcChatListViewController()

    $('#btn-add-server').on('click', e => {
      this.displayServerConnectionManager()
    })

    $('#lbl-connect-to-server').text(__('CONNECT_TO_SERVER'))
  }

  connectToServer (server, port, registrationInfo) {
    let client = new IrcClient()
    client.floodPreventer = new IrcFloodPreventer(4, 2000)

    ipcRenderer.on('close', (e, data) => {
      client.quit()
    })

    ipcRenderer.on('reload', (e, data) => {
      client.quit()
    })

    ipcRenderer.on('view-preferences', (e, data) => {
      this.settingsWindow = new remote.BrowserWindow({
        'width': 380,
        'height': 315,
        'title': 'jsIRC - Settings',
        'title-bar-style': 'hidden',
        'resizable': false,
        'modal': true,
        'alwaysOnTop': true,
        'parent': remote.getCurrentWindow(),
        'webPreferences': {
          'devTools': !isPackaged
        }
      })

      this.settingsWindow.setMenu(null)
      this.settingsWindow.loadURL(path.join('file://', __dirname, '/settings.html'))

      this.settingsWindow.on('closed', (e) => {
        this.settingsWindow = null
      })
    })

    if (!isPackaged) {
      client.on('in', (message) => { console.debug(message) })
      client.on('out', (message) => { console.debug(message) })
    }

    client.reconnectAttempts = 0
    client.on('connectionError', () => { this.reconnect(client) })
    client.on('disconnected', () => { this.reconnect(client) })
    client.on('connected', () => { client.reconnectAttempts = 0 })

    client.on('connecting', () => {
      store.set('hostName', client.hostName)
      store.set('port', client.port)
    })

    client.once('protocolError', (command, errorName, errorParameters, errorMessage) => {
      if (command === 433) {
        let alternativeNickName = store.get('alternative')
        if (alternativeNickName && alternativeNickName.length > 0) {
          client.setNickName(alternativeNickName)
        }
      }
    })

    this.chatListViewController.addServer(client)
    this.chatListViewController.on('viewUser', (client, user) => {
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

  reconnect (client) {
    if (client.reconnectAttempts === 10) {
      return
    }
    client.reconnectAttempts++

    setTimeout(() => {
      client.connect(client.hostName, client.port, client.registrationInfo)
    }, 2000)
  }

  displayServerConnectionManager () {
    // "Window"
    let inlineWindow = $('<div />', {
      'id': 'connect-to-server-prompt',
      'class': 'prompt-window'
    }).appendTo('body')

    // Title
    $('<div />', {
      'class': 'prompt-title',
      'text': __('CONNECT_TO_SERVER')
    }).append(
      $('<span />', {
        'class': 'close',
        'click': () => inlineWindow.remove()
      })
    ).appendTo(inlineWindow)

    // Container
    let innerView = $('<div />', {
      'style': 'padding: 10px'
    }).appendTo(inlineWindow)

    // Input Fields
    $('<div />', { 'text': __('CONNECT_ADDRESS') }).appendTo(innerView)

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
      'value': store.get('hostName'),
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': __('CONNECT_PORT') }).appendTo(innerView)

    let port = $('<input />', {
      'type': 'text',
      'style': '',
      'value': store.get('port'),
      'onEnter': submit
    }).appendTo(innerView)

    port.val('6667')

    $('<div />', { 'text': __('CONNECT_NICKNAME') }).appendTo(innerView)

    let nickName = $('<input />', {
      'type': 'text',
      'style': '',
      'value': store.get('nickName'),
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': __('CONNECT_NAME') }).appendTo(innerView)

    let realName = $('<input />', {
      'type': 'text',
      'style': '',
      'value': store.get('realName'),
      'onEnter': submit
    }).appendTo(innerView)

    $('<div />', { 'text': __('CONNECT_EMAIL') }).appendTo(innerView)

    let email = $('<input />', {
      'type': 'text',
      'style': '',
      'value': store.get('email'),
      'onEnter': submit
    }).appendTo(innerView)

    $('<button />', {
      'text': __('BUTTON_CONNECT'),
      'type': 'submit',
      'class': 'btn btn-primary',
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

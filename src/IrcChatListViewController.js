// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { shell } = remote

const events = require('events')
const { EventEmitter } = events

const IrcChatViewController = require('./IrcChatViewController.js')
const $ = require('jquery')

class IrcChatListViewController extends EventEmitter {
  constructor () {
    super()

    this.connections = {}

    $(document).on('click', 'a[href^="http"]', function (event) {
      event.preventDefault()
      shell.openExternal(this.href)
    })
  }

  addServer (client) {
    let chatViewController = new IrcChatViewController(client)
    this.connections[client.id] = chatViewController
  }

  viewServer (client, serverName) {
    Object.keys(this.connections).forEach((key, index) => {
      this.connections[key].hide()
    })

    this.connections[client.id].viewServer(serverName)
    this.selectedConnection = this.connections[client.id]
  }

  viewChannel (client, channel) {
    Object.keys(this.connections).forEach((key, index) => {
      this.connections[key].hide()
    })

    this.connections[client.id].viewChannel(channel)
    this.selectedConnection = this.connections[client.id]
  }
}

module.exports = IrcChatListViewController

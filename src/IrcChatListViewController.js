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
    chatViewController.on('viewUser', (client, user) => {
      this.emit('viewUser', client, user)
    })
    this.connections[client.id] = chatViewController
  }

  quitServer (client) {
    this.connections[client.id].remove()
    delete this.connections[client.id]
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

  viewUser (client, user) {
    Object.keys(this.connections).forEach((key, index) => {
      this.connections[key].hide()
    })

    this.connections[client.id].viewUser(user)
    this.selectedConnection = this.connections[client.id]
  }

  hideUser (client, user) {
    this.connections[client.id].hideUser(user)
  }
}

module.exports = IrcChatListViewController

-// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, BrowserWindow, app } = remote

const events = require('events')
const { EventEmitter } = events

const IrcNetworkController = require('./IrcNetworkController.js')

class IrcNetworkListController extends EventEmitter {
  constructor () {
    super()

    this.selectedView = null
    this.connections = {}

    window.addEventListener('keyup', e => {
      if (e.ctrlKey) {
        if (e.keyCode === 78) { // ctrl+n
          this.viewNextChannel()
        } else if (e.keyCode === 87) { // ctrl+w
          this.partCurrentChannel()
        }
      }
    })
  }

  addServer(client) {
    let networkController = new IrcNetworkController(client)
    networkController.on('viewChannel', this.viewChannel.bind(this))
    networkController.on('viewServer', this.viewServer.bind(this))
    this.connections[client.id] = networkController
  }

  viewChannel (client, channel) {
    this.emit('viewChannel', client, channel)
  }

  viewServer (client, serverName) {
    this.emit('viewServer', client, serverName)
  }

  partCurrentChannel () {
    // Only implemented for the first connection atm.
    var clientId = Object.keys(this.connections)[0]
    var connection = this.connections[clientId]

    if (connection.selectedChannel) {
      connection.selectedChannel.part()
    }
  }

  viewNextChannel () {
    // Only implemented for the first connection atm.
    var clientId = Object.keys(this.connections)[0]
    var connection = this.connections[clientId]

    let keys = Object.keys(connection.channels)
    if (connection.selectedChannel) {
      let index = keys.indexOf(connection.selectedChannel.name)
      let nextChannel = connection.channels[keys[index + 1]]
      if (nextChannel) {
        connection.viewChannel(nextChannel.channel)
      } else {
        connection.viewServer()
      }
    } else {
      let firstChannel = connection.channels[keys[0]]
      if (firstChannel) {
        connection.viewChannel(firstChannel.channel)
      } else {
        connection.viewServer()
      }
    }
  }
}

module.exports = IrcNetworkListController

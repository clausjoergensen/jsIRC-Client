// Copyright (c) 2018 Claus Jørgensen
'use strict'

const events = require('events')
const { EventEmitter } = events

const IrcNetworkViewController = require('./IrcNetworkViewController.js')

require('./IrcBroadcaster.js')

class IrcNetworkListViewController extends EventEmitter {
  constructor () {
    super()

    this.connections = {}
    this.selectedConnection = null

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

  addServer (client) {
    let networkController = new IrcNetworkViewController(client)

    networkController.once('quit', (client) => {
      delete this.connections[client.id]
      if (this.selectedConnection === networkController) {
        this.viewNextServer()
      }
      this.emit('quit', client)
    })

    networkController.on('viewChannel', (client, channel) => {
      this.hideOthers(networkController)
      this.selectedConnection = networkController
      this.emit('viewChannel', client, channel)
    })

    networkController.on('viewServer', (client) => {
      this.hideOthers(networkController)
      this.selectedConnection = networkController
      this.emit('viewServer', client)
    })

    networkController.on('viewUser', (client, user) => {
      this.hideOthers(networkController)
      this.selectedConnection = networkController
      this.emit('viewUser', client, user)
    })

    networkController.on('hideUser', (client, user) => {
      this.emit('hideUser', client, user)
    })

    this.connections[client.id] = networkController
    this.selectedConnection = networkController
  }

  addUser (client, user) {
    if (!this.connections[client.id]) {
      console.error('Attempted to start a chat with a user without being connected to a server.')
      return
    }

    this.connections[client.id].addUserToList(user)
    this.connections[client.id].viewUser(user)
  }

  hideOthers (selected) {
    Object.keys(this.connections).forEach((key, index) => {
      if (this.connections[key] !== selected) {
        this.connections[key].deselect()
      }
    })
  }

  partCurrentChannel () {
    if (this.selectedConnection.selectedChannel) {
      this.selectedConnection.selectedChannel.part()
    }
  }

  viewNextChannel () {
    let connection = this.selectedConnection
    let keys = Object.keys(connection.channels)
    if (connection.selectedChannel) {
      let index = keys.indexOf(connection.selectedChannel.name)
      if (index === -1) {
        this.viewNextServer()
      } else {
        let nextChannel = connection.channels[keys[index + 1]]
        if (nextChannel) {
          connection.viewChannel(nextChannel.channel)
        } else {
          this.viewNextServer()
        }
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

  viewNextServer () {
    let connection = this.selectedConnection
    let keys = Object.keys(this.connections)
    let index = keys.indexOf(connection.client.id)

    let nextConnection = null
    if (index === (keys.length - 1)) {
      nextConnection = this.connections[keys[0]]
    } else {
      nextConnection = this.connections[keys[index + 1]]
    }

    if (nextConnection) {
      connection.deselect()
      nextConnection.viewServer()
    }
  }
}

module.exports = IrcNetworkListViewController

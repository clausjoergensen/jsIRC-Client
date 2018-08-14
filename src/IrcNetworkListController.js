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

    /*window.addEventListener('keyup', e => {
      if (e.ctrlKey) {
        if (e.keyCode === 78) { // ctrl+n
          this.viewNextChannel(client)
        } else if (e.keyCode === 87) { // ctrl+w
          if (this.selectedChannel) {
            this.selectedChannel.part()
          }
        }
      }
    })*/
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

  viewNextChannel (client) {
    /*if (this.selectedChannel) {
      let keys = Object.keys(this.connections[client.id].channels)
      let index = keys.indexOf(this.selectedChannel.name)
      let nextChannelElement = this.connections[client.id].channels[keys[index + 1]]
      if (nextChannelElement) {
        this.viewChannel(client, nextChannelElement.channel)
      } else {
        this.viewServer(client, client.serverName)
      }
    } else {
      let keys = Object.keys(this.connections[client.id].channels)
      let firstChannelElement = this.connections[client.id].channels[keys[0]]
      if (firstChannelElement) {
        this.viewChannel(client, firstChannelElement.channel)
      } else {
        this.viewServer(client, client.serverName)
      }
    }*/
  }
}

module.exports = IrcNetworkListController

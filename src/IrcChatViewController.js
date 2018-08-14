// Copyright (c) 2018 Claus Jørgensen
'use strict'

const events = require('events')
const { EventEmitter } = events

const { CtcpClient } = require('jsirc')

const IrcServerViewController = require('./IrcServerViewController.js')
const IrcChannelViewController = require('./IrcChannelViewController.js')

const packageInfo = require('./../package.json')

class IrcChatViewController extends EventEmitter {
  constructor (client) {
    super()

    this.client = client

    this.ctcpClient = new CtcpClient(client)
    this.ctcpClient.clientName = packageInfo.name
    this.ctcpClient.clientVersion = packageInfo.version

    this.serverViewController = new IrcServerViewController(this.client, this.ctcpClient)
    this.channels = {}

    this.client.on('connected', () => {
      this.client.localUser.on('joinedChannel', (channel) => {
        this.channels[channel.name] = new IrcChannelViewController(this.client, this.ctcpClient, channel)
      })

      this.client.localUser.on('partedChannel', (channel) => {
        delete this.channels[channel.name]
      })
    })
  }

  sendMessage (message) {
    if (this.selectedChannel) {
      this.selectedChannel.sendMessage(message)
    }    
  }
  
  hide () {
    this.hideServer()
    this.hideAllChannels()
  }

  viewServer (serverName) {
    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }
    
    this.selectedChannel = null
    this.serverViewController.show()
  }

  viewChannel (channel) {
    this.hideServer()

    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }

    if (this.channels[channel.name]) {
      this.selectedChannel = this.channels[channel.name]
      this.selectedChannel.show()
    }
  }

  hideServer () {
    this.serverViewController.hide()
  }

  hideAllChannels () {
    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].hide()
    })
  }
}

module.exports = IrcChatViewController

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
    this.selectedChannel = null

    this.client.on('connected', () => {
      this.client.localUser.on('joinedChannel', (channel) => {
        this.channels[channel.name] = new IrcChannelViewController(this.client, this.ctcpClient, channel)
      })

      this.client.localUser.on('partedChannel', (channel) => {
        this.channels[channel.name].remove()
        delete this.channels[channel.name]
      })
    })

    this.client.on('registered', () => { this.client.joinChannel('#testing') })

    this.client.on('protocolError', this.protocolError.bind(this))
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

    this.selectedChannel = null
  }

  protocolError (command, errorName, errorParameters, errorMessage) {
    switch (command) {
      case 433: // ERR_NICKNAMEINUSE
        this.serverViewController.displayError(`Nickname '${errorParameters[0]}' is already in use.`)
        this.emit('nickNameAlreadyInUse')
        break
      case 482: // ERR_CHANOPRIVSNEEDED
        if (this.selectedChannel) {
          this.selectedChannel.displayError(errorParameters[0], errorMessage)
        }
        break
      default:
        console.warn(`Unsupported protocol error ${errorName}(${command}).`, errorParameters, errorMessage)
        break
    }
  }
}

module.exports = IrcChatViewController

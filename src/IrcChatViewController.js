// Copyright (c) 2018 Claus Jørgensen
'use strict'

const events = require('events')
const { EventEmitter } = events

const { CtcpClient } = require('jsirc')

const IrcServerViewController = require('./IrcServerViewController.js')
const IrcChannelViewController = require('./IrcChannelViewController.js')
const IrcUserViewController = require('./IrcUserViewController.js')

const packageInfo = require('./../package.json')

class IrcChatViewController extends EventEmitter {
  constructor (client) {
    super()

    this.client = client

    this.ctcpClient = new CtcpClient(client)
    this.ctcpClient.clientName = 'jsIRC'
    this.ctcpClient.clientVersion = packageInfo.version

    this.serverViewController = new IrcServerViewController(this.client, this.ctcpClient)

    this.channels = {}
    this.selectedChannel = null

    this.users = {}
    this.selectedUser = null

    this.client.on('connected', () => {
      this.client.localUser.on('joinedChannel', (channel) => {
        let channelViewController = new IrcChannelViewController(this.client, this.ctcpClient, channel)

        channelViewController.on('chatWithUser', (user) => {
          let userViewController = new IrcUserViewController(this.client, this.ctcpClient, user)
          this.users[user.nickName] = userViewController
          this.viewUser(user)

          this.emit('chatWithUser', this.client, user)
        })

        this.channels[channel.name] = channelViewController
      })

      this.client.localUser.on('partedChannel', (channel) => {
        this.channels[channel.name].remove()
        delete this.channels[channel.name]
      })

      this.client.localUser.on('notice', (source, targets, noticeText) => {
        Object.keys(this.channels).forEach((key, index) => {
          this.channels[key].displayNotice(source, noticeText)
        })
      })

      this.client.localUser.on('message', (source, targets, messageText) => {
        if (this.users[source.nickName]) {
          return
        }
        let userViewController = new IrcUserViewController(this.client, this.ctcpClient, source)
        this.users[source.nickName] = userViewController
        this.users[source.nickName].displayMessage(source, messageText)
      })
    })

    this.client.on('registered', () => { this.client.joinChannel('#testing') })
    this.client.on('protocolError', this.protocolError.bind(this))
  }

  hide () {
    this.hideServer()
    this.hideAllChannels()
    this.hideAllUsers()
  }

  remove () {
    this.serverViewController.remove()
    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].remove()
    })
    Object.keys(this.users).forEach((key, index) => {
      this.users[key].remove()
    })
  }

  viewServer () {
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

    if (this.selectedUser) {
      this.selectedUser.hide()
    }

    if (this.channels[channel.name]) {
      this.selectedChannel = this.channels[channel.name]
      this.selectedChannel.show()
    }
  }

  viewUser (user) {
    this.hideServer()

    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }

    if (this.users[user.nickName]) {
      this.selectedUser = this.users[user.nickName]
      this.selectedUser.show()
    }
  }

  hideUser (user) {
    this.users[user.nickName].remove()
    delete this.users[user.nickName]
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

  hideAllUsers () {
    Object.keys(this.users).forEach((key, index) => {
      this.users[key].hide()
    })

    this.selectedUser = null
  }

  protocolError (command, errorName, errorParameters, errorMessage) {
    switch (command) {
      case 433: // ERR_NICKNAMEINUSE
        this.serverViewController.displayError(`Nickname '${errorParameters[0]}' is already in use.`)
        this.serverViewController.focusInput('/nick ')
        break
      case 482: // ERR_CHANOPRIVSNEEDED
        {
          let channel = this.channels[errorParameters[0]]
          if (channel) {
            channel.displayError(errorMessage)
          }
        }
        break
      case 473: // ERR_INVITEONLYCHAN
        this.serverViewController.displayError(`Unable to join channel ${errorParameters[0]} (invite only).`)
        break
      case 475: // ERR_BADCHANNELKEY
        this.serverViewController.displayError(`Unable to join channel ${errorParameters[0]} (need correct key).`)
        break
      default:
        console.warn(`Unsupported protocol error ${errorName}(${command}).`, errorParameters, errorMessage)
        break
    }
  }
}

module.exports = IrcChatViewController

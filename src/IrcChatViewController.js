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
        delete this.channels[channel.name]
      })
    })

    this.client.on('protocolError', this.protocolError.bind(this))
  }

  sendUserInput (text) {
    if (text[0] === '/') {
      this.sendAction(text)
    } else {
      if (this.selectedChannel) {
        text.match(/.{1,398}/g).forEach(this.sendMessage.bind(this))
      } else {
        this.serverViewController.displayMessage(null, '* You are not on a channel')
      }
    }
  }

  sendMessage (message) {
    if (this.selectedChannel) {
      this.selectedChannel.sendMessage(message)
    }
  }

  sendAction (text) {
    let firstSpace = text.substring(1).indexOf(' ')
    let action = text.substring(1, firstSpace + 1)
    let content = text.substring(1).substr(firstSpace + 1)

    if (firstSpace === -1) {
      action = text.substring(1)
      content = ''
    }

    switch (action.toLowerCase()) {
      case 'msg':
        {
          let target = content.substr(0, content.indexOf(' '))
          let message = content.substr(content.indexOf(' ') + 1)
          this.client.sendMessage([target], message)
        }
        break
      case 'join':
        this.client.joinChannel(content)
        break
      case 'part':
        this.selectedChannel.part()
        break
      case 'me':
        if (this.selectedChannel) {
          this.ctcpClient.action([this.selectedChannel.name], content)
          this.displayction(this.selectedChannel.name, this.client.localUser, content)
        } else {
          this.serverViewController.displayMessage(null, '* Cannot use /me in this view.')
        }
        break
      case 'nick':
        this.client.setNickName(content)
        break
      case 'topic':
        if (this.selectedChannel) {
          this.client.setTopic(this.selectedChannel.name, content)
        }
        break
      case 'hop':
        {
          let newChannel = content.substr(content.indexOf(' ') + 1).trim()
          if (this.selectedChannel) {
            var name = this.selectedChannel.name
            this.selectedChannel.part()
            if (newChannel.length !== 0) {
              this.client.joinChannel(newChannel)
            } else {
              this.client.joinChannel(name)
            }
          } else {
            this.serverViewController.displayMessage(null, '* Cannot use /hop in this view.')
          }
        }
        break
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
        console.error(`Unsupported protocol error ${errorName}(${command}).`, errorParameters, errorMessage)
        break
    }
  }
}

module.exports = IrcChatViewController

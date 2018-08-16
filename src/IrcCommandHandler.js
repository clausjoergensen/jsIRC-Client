// Copyright (c) 2018 Claus Jørgensen
'use strict'

const __ = require('./i18n.js')

/**
 * @callback displayMessage
 * @param {IrcUser} source
 * @param {string} message
 */

class IrcCommandHandler {
  constructor (client, ctcpClient, channel = null) {
    this.client = client
    this.ctcpClient = ctcpClient
    this.channel = channel
  }

  static isCommand (text) {
    return text[0] === '/'
  }

  /**
   * Parses and handles text commands
   *
   * @param {string} text The command text
   * @param {displayMessage} [displayMessage] The callback for displaying any possible UI messages.
   */
  handle (text, displayMessage = null) {
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
          this.client.sendMessage([target], message) // display 1:1 somehow?
        }
        break
      case 'notice':
        {
          let target = content.substr(0, content.indexOf(' '))
          let notice = content.substr(content.indexOf(' ') + 1)
          this.client.sendNotice([target], notice)
        }
        break
      case 'join':
        {
          let [channelName, key] = content.split(' ')
          this.client.joinChannel(channelName, key)
        }
        break
      case 'nick':
        this.client.setNickName(content)
        break
      case 'part':
        this.channel.part(content)
        break
      case 'mode':
        {
          let match = content.match(/([#+!&].+) ([+-]{1})([pmsintlkqaohv]{1})[\s?]{1}(.*)/)
          if (this.channel && match && this.channel.name === match[1]) {
            this.client.setChannelModes(this.channel, `${match[2]}${match[3]}`, [match[4]])
          } else {
            let [nickName, modes] = content.split(' ')
            if (nickName === this.client.localUser.nickName) {
              this.client.localUser.setModes(modes)
            }
          }
        }
        break
      case 'me':
        if (!this.channel) {
          return
        }
        this.ctcpClient.action([this.channel.name], content)
        if (displayMessage) {
          displayMessage(this.client.localUser, content)
        }
        break
      case 'topic':
        this.channel.setTopic(content)
        break
      case 'hop':
        {
          let channelName = this.channel.name
          this.channel.part()
          let [newChannelName] = content.split(' ')
          if (newChannelName) {
            this.client.joinChannel(newChannelName)
          } else {
            this.client.joinChannel(channelName)
          }
        }
        break
      default:
        if (displayMessage) {
          displayMessage(null, __('UNKNOWN_COMMAND'))
        }
        break
    }
  }
}

module.exports = IrcCommandHandler

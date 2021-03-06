// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const events = require('events')
const { EventEmitter } = events

const __ = require('./i18n.js')

require('./IrcBroadcaster.js')

function equalsCaseInsensitive (a, b) {
  return a.localeCompare(b, undefined, { sensitivity: 'base' }) === 0
}

/**
 * @callback displayMessage
 * @param {IrcUser} source
 * @param {string} message
 */

class IrcCommandHandler extends EventEmitter {
  constructor (client, ctcpClient, channel = null) {
    super()
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
    let content = text.substring(1).substr(firstSpace + 1).trim()

    if (firstSpace === -1) {
      action = text.substring(1)
      content = ''
    }

    switch (action.toLowerCase()) {
      case 'msg':
        {
          let [target] = content.split(' ', 1)
          let message = content.substring(target.length + 1)
          if (message && !equalsCaseInsensitive(target, this.client.localUser.nickName)) {
            this.client.sendMessage([target], message)
            let user = this.client.getUserFromNickName(target)
            if (user) {
              this.emit('viewUser', user, message)
            }
          }
        }
        break
      case 'notice':
        {
          let [target] = content.split(' ', 1)
          let notice = content.substring(target.length + 1)
          if (notice && !equalsCaseInsensitive(target, this.client.localUser.nickName)) {
            this.client.sendNotice([target], notice)
          }
        }
        break
      case 'kick':
        if (this.channel && content) {
          let [target] = content.split(' ', 1)
          let reason = content.substring(target.length + 1)
          if (target) {
            this.channel.kick(target, reason && reason.length > 0 ? reason : null)
          }
        }
        break
      case 'ban':
        {
          let [target] = content.split(' ', 1)
          if (this.channel && target) {
            this.channel.ban(target)
          }
        }
        break
      case 'away':
        if (this.client.localUser.isAway) {
          this.client.localUser.unsetAway()
        } else {
          this.client.localUser.setAway(content && content.length > 0 ? content : null)
        }
        break
      case 'join':
        {
          let [channelName, key] = content.split(' ')
          if (channelName && channelName) {
            this.client.joinChannel(channelName, key && key.length > 0 ? key : null)
          }
        }
        break
      case 'nick':
        if (content) {
          this.client.setNickName(content)
        }
        break
      case 'quit':
        this.client.quit(content && content.length > 0 ? content : null)
        break
      case 'part':
        if (this.channel) {
          this.channel.part(content && content.length > 0 ? content : null)
        }
        break
      case 'mode':
        {
          let match = content.match(/([#+!&].+) ([+-]{1})([pmsintlkqaohv]{1})[\s]?(.*)/)
          if (this.channel && match && equalsCaseInsensitive(this.channel.name, match[1])) {
            this.client.setChannelModes(this.channel, `${match[2]}${match[3]}`, [match[4]])
          } else {
            let [nickName, modes] = content.split(' ')
            if (modes && equalsCaseInsensitive(nickName, this.client.localUser.nickName)) {
              this.client.localUser.setModes(modes)
            }
          }
        }
        break
      case 'me':
        if (this.channel && content) {
          this.ctcpClient.action([this.channel.name], content)
          if (displayMessage) {
            displayMessage(this.client.localUser, content)
          }
        }
        break
      case 'topic':
        if (this.channel && content) {
          this.channel.setTopic(content)
        }
        break
      case 'invite':
        {
          let [target] = content.split(' ')
          if (this.channel && target) {
            this.channel.invite(target)
          }
        }
        break
      case 'hop':
        if (this.channel) {
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
      case 'raw':
        if (content) {
          this.client.sendRawMessage(content)
        }
        break
      case 'server':
        {
          if (!content || this.channel) {
            return
          }
          let [hostName, port] = content.split(':')
          this.client.disconnect()
          this.client.connect(hostName, parseInt(port) || 6667, this.client.registrationInfo)
        }
        break
      case 'clear':
        this.emit('clear')
        break
      case 'clearall':
        global.broadcaster.emit('clearAll')
        break
      case 'list':
        {
          if (!displayMessage) {
            return
          }

          if (this.channel) {
            return
          }

          let [mask] = content.split(' ', 1)
          let [, minParam, maxParam] = content.split('-')

          let min, max
          if (minParam && minParam.toLowerCase().startsWith('min')) {
            min = parseInt(minParam.split(' ')[1])
          }
          if (maxParam && maxParam.toLowerCase().startsWith('max')) {
            max = parseInt(maxParam.split(' ')[1])
          }

          this.client.once('channelList', (channelList) => {
            let channels = channelList
            if (min >= 0 && max >= 0) {
              channels = channelList.filter(x => x.visibleUsersCount >= min && x.visibleUsersCount <= max)
            } else if (min >= 0) {
              channels = channelList.filter(x => x.visibleUsersCount >= min)
            }

            channels = channels.sort((a, b) => { // descending sort
              if (a.visibleUsersCount === b.visibleUsersCount) {
                return 0
              }
              return a.visibleUsersCount > b.visibleUsersCount ? -1 : 1
            })

            let rows = channels.map(channelInfo => {
              return `<tr><td>${channelInfo.channelName.trim()}</td>` +
                `<td>${channelInfo.visibleUsersCount}</td>` +
                `<td class="topic">${channelInfo.topic.trim()}</td></tr>`
            })

            let table = '<table class="table-striped cmd-list-table">' +
              '<thead>' +
              `<tr><th>${__('LIST_TH_CHANNEL')}</th>` +
              `<th>${__('LIST_TH_USERS')}</th>` +
              `<th>${__('LIST_TH_TOPIC')}</th></tr>` +
              '</thead>' +
              `<tbody>${rows.join('')}</tbody>` +
              '</table>'

            displayMessage(null, table, { timestamp: false, html: true })
          })

          let searchMask = mask
          if (mask.startsWith('-')) {
            searchMask = null
          } else if (mask.length === 0) {
            searchMask = null
          } else {
            searchMask = searchMask.split(',')
          }
          this.client.listChannels(searchMask)
        }
        break
        case 'who':
        {
          if (!displayMessage) {
            return
          }

          if (this.channel) {
            return
          }

          this.client.once('whoReply', (userInfoList) => {
            let rows = userInfoList.map(userInfo => {
              return `<tr><td>${userInfo.channel.name}</td>` +
                     `<td>${userInfo.user.nickName}</td>` +
                     `<td>${userInfo.user.isAway ? __('USER_AWAY') : __('USER_ONLINE')}</td></tr>`
            })

            let table = '<table class="table-striped cmd-list-table">' +
              '<thead>' +
              `<tr><th>${__('WHO_TH_CHANNEL')}</th>` +
              `<th>${__('WHO_TH_USER')}</th>` +
              `<th>${__('WHO_TH_STATUS')}</th></tr>` +
              '</thead>' +
              `<tbody>${rows.join('')}</tbody>` +
              '</table>'

            displayMessage(null, table, { timestamp: false, html: true })
          })

          this.client.queryWho(content)
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

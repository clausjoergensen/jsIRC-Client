// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const { remote } = require('electron')
const { Menu, app } = remote

const events = require('events')
const { EventEmitter } = events

const IrcMessageFormatter = require('./IrcMessageFormatter.js')
const IrcCommandHandler = require('./IrcCommandHandler.js')

const prettyMs = require('pretty-ms')
const inputhistory = require('./external/inputhistory.js') // eslint-disable-line no-unused-vars
const __ = require('./i18n.js')
const $ = require('jquery')

require('./IrcBroadcaster.js')

class IrcServerViewController extends EventEmitter {
  constructor (client, ctcpClient) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient

    this.commandHandler = new IrcCommandHandler(this.client, this.ctcpClient)
    this.commandHandler.on('clear', () => {
      this.serverView.empty()
    })

    global.broadcaster.on('clearAll', () => {
      this.serverView.empty()
    })

    this.client.on('connecting', (hostName, port) => {
      this.displayText(__('CONNECTING_TO', hostName, port), { 'class': 'client-event' })
      this.displaySeperator()
    })

    this.client.on('disconnected', (reason) => {
      this.displayText(__('DISCONNECTED', reason), { 'class': 'client-event' })
      this.displaySeperator()
    })

    this.client.on('connected', () => {
      this.client.localUser.on('modes', (newModes) => {
        this.displayText(__('USER_SET_MODES', this.client.localUser.nickName, newModes),
          { 'class': 'client-action' })
        this.displaySeperator()
      })
      this.client.localUser.on('notice', (source, targets, noticeText) => {
        let channelUsers = this.client.localUser.getChannelUsers()
        if (channelUsers.length === 0) {
          this.displayMessage(source, noticeText, true)
        }
      })
      this.client.localUser.on('kicked', (source, channel, comment) => {
        this.displayText(__('YOU_KICKED', channel, source.nickName, comment ? `(${comment})` : ''),
          { 'class': 'client-action' })
        this.displaySeperator()
      })
    })

    this.client.on('error', errorMessage => {
      this.displayError('* ' + errorMessage)
    })

    this.client.on('protocolError', (command, errorName, errorParameters, errorMessage) => {
      if (command === 433) {
        this.focusInput('/nick ')
      }
    })

    this.client.on('hostHidden', (hostName) => {
      this.displayText(__('DISPLAY_HOST', hostName))
      this.displaySeperator()
    })

    this.client.on('clientInfo', (welcomeMessage) => {
      this.displayText(this.client.welcomeMessage || '')
      this.displayText(this.client.yourHostMessage || '')
      this.displayText(this.client.serverCreatedMessage || '')
      this.displaySeperator()
    })

    this.client.on('whoIsReply', (user) => {
      this.displayText(__('WHOIS_REPLY_1', user.nickName, user.userName, user.hostName, user.realName))

      let channels = user.getChannelUsers().map(cu => cu.channel.name).join(' ')
      this.displayText(__('WHOIS_REPLY_2', user.nickName, channels))

      if (user.isAway) {
        this.displayText(__('WHOIS_REPLY_3', user.nickName, user.awayMessage))
      }

      this.displayText(__('WHOIS_REPLY_4', user.nickName, user.serverName, user.serverInfo))

      if (user.idleDuration > 0) {
        this.displayText(__('WHOIS_REPLY_5', user.nickName, prettyMs(user.idleDuration * 1000, { verbose: true })))
      }

      this.displayText(__('WHOIS_REPLY_6', user.nickName))
      this.displaySeperator()
    })

    this.client.on('motd', messageOfTheDay => {
      this.displayText(__('MOTD_TITLE', this.client.serverName), { preformatted: true })
      messageOfTheDay
        .split('\r\n')
        .forEach(line => this.displayText(line, { preformatted: true, stripColors: true }))
      this.displaySeperator()
    })

    this.client.on('connectionError', error => {
      if (error.code === 'ECONNREFUSED') {
        this.displayError(__('ECONNREFUSED'), 'client-event')
      } else if (error.code === 'ECONNRESET') {
        this.displayText(__('ECONNRESET'), 'client-event')
      } else if (error.code === 'ENOTFOUND') {
        this.displayError(__('ENOTFOUND'), 'client-event')
      } else {
        console.error(error)
      }
    })

    this.client.on('networkInfo', networkInfo => {
      // First display when all information been recieved.
      this.displayText(__('NETWORK_INFO_1',
        networkInfo.visibleUsersCount, networkInfo.invisibleUsersCount, networkInfo.serversCount))
      this.displayText(__('NETWORK_INFO_2', networkInfo.channelsCount))
      this.displayText(__('NETWORK_INFO_3', networkInfo.serverClientsCount, networkInfo.serverServersCount))
      this.displaySeperator()
    })

    this.client.on('localUsers', (current, max) => {
      this.displayText(__('RPL_LOCALUSERS', current, max))
    })

    this.client.on('globalUsers', (current, max) => {
      this.displayText(__('RPL_GLOBALUSERS', current, max))
      this.displaySeperator()
    })

    this.client.on('serverTime', (server, dateTime) => {
      this.displayText(dateTime)
      this.displaySeperator()
    })

    this.ctcpClient.on('ping', (source, pingTime) => {
      this.displayAction(__('PING_REPLY', source.nickName, pingTime))
    })

    this.ctcpClient.on('time', (source, dateTime) => {
      this.displayAction(__('TIME_REPLY', source.nickName, dateTime))
    })

    this.ctcpClient.on('version', (source, versionInfo) => {
      this.displayAction(__('VERSION_REPLY', source.nickName, versionInfo))
    })

    this.ctcpClient.on('finger', (source, info) => {
      this.displayAction(__('FINGER_REPLY', source.nickName, info))
    })

    this.ctcpClient.on('clientInfo', (source, info) => {
      this.displayAction(__('CLIENTINFO_REPLY', source.nickName, info))
    })

    this.ctcpClient.on('rawMessageSent', (message) => {
      if (message.tag !== 'ACTION') {
        this.displayAction(__('CTCP_SENT_MSG_FORMAT', message.targets[0], message.tag))
      }
    })

    this.createServerView()
  }

  show () {
    this.serverView.css('display', 'block')
    this.serverToolbar.css('display', 'block')
    this.serverToolbar.find('.chat-input')[0].focus()
    this.scrollToBottom()
  }

  hide () {
    this.serverView.css('display', 'none')
    this.serverToolbar.css('display', 'none')
  }

  remove () {
    this.serverView.remove()
    this.serverToolbar.remove()
  }

  scrollToBottom () {
    this.serverView.scrollTop(this.serverView.prop('scrollHeight'))
  }

  focusInput (message = null) {
    let input = this.serverToolbar.find('.chat-input')
    if (message) {
      input.val(message)
    }
    input.focus()
  }

  displayText (text, options) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, $.extend({
      isServer: true, isAction: true, detectLinks: false
    }, options))
    this.serverView.append(paragraph)
    this.markAsUnread()
  }

  displayAction (text) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, { isServer: true, isAction: true })
    this.serverView.append(paragraph)
    this.displaySeperator()
    this.markAsUnread()
  }

  displayError (text) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, { isServer: true, isError: true })
    this.serverView.append(paragraph)
    this.displaySeperator()
    this.markAsUnread()
  }

  displayNotice (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, { isServer: true, isNotice: true })
    this.serverView.append(paragraph)
    this.displaySeperator()
    this.markAsUnread()
  }

  displayMessage (source, text, options) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, $.extend({ isServer: true }, options))
    this.serverView.append(paragraph)
    this.displaySeperator()
    this.markAsUnread()
  }

  displaySeperator () {
    this.serverView.append(IrcMessageFormatter.seperator())
    this.scrollToBottom()
  }

  markAsUnread () {
    let network = Array.from(
      document.getElementById('network-list').querySelectorAll('ul.network')
    ).find(x => x.clientId === this.client.id)

    if (network && !network.firstChild.classList.contains('network-selected')) {
      network.firstChild.classList.add('nav-unread')
    }
  }

  sendUserInput (text) {
    if (!text) {
      return
    }

    if (IrcCommandHandler.isCommand(text)) {
      this.commandHandler.handle(text.trim(), (source, text, options) => {
        this.displayMessage(source, text, options)
      })
    } else {
      this.displayMessage(null, __('NOT_ON_A_CHANNEL'))
    }

    this.scrollToBottom()
  }

  createServerView () {
    const serverMenu = Menu.buildFromTemplate([
      {
        label: __('SERVER_MENU_NETWORK_INFO'),
        click: () => {
          this.client.getNetworkInfo()
        }
      },
      {
        label: __('SERVER_MENU_TIME'),
        click: () => {
          this.client.getServerTime()
        }
      },
      {
        label: __('SERVER_MENU_MOTD'),
        click: () => {
          this.client.getMessageOfTheDay()
        }
      },
      { type: 'separator' },
      {
        label: __('SERVER_MENU_QUIT'),
        click: () => {
          app.quit()
        }
      }
    ])

    let rightColumn = $('#right-column')

    this.serverView = $('<div />', {
      'class': 'server-view',
      'style': 'display: none',
      'contextmenu': (e) => {
        e.preventDefault()
        serverMenu.popup({ window: remote.getCurrentWindow() })
      }
    }).appendTo(rightColumn)

    this.serverToolbar = $('<div />', {
      class: 'toolbar toolbar-footer',
      style: 'height: 40px; display: none'
    }).appendTo(rightColumn)

    let input = $('<input />', {
      'type': 'text',
      'class': 'chat-input',
      'placeholder': __('PLACEHOLDER_SEND_MESSAGE'),
      'autofocus': true
    }).appendTo(this.serverToolbar)

    input.keyup((e) => {
      if (e.keyCode === 13) {
        this.sendUserInput(input.val())
        input.val('')
      }
    })

    input.inputhistory()
  }
}

module.exports = IrcServerViewController

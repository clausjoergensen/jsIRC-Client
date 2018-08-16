// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, app } = remote

const events = require('events')
const { EventEmitter } = events

const IrcMessageFormatter = require('./IrcMessageFormatter.js')

const strftime = require('strftime')
const prettyMs = require('pretty-ms')
const inputhistory = require('./inputhistory.js')
const __ = require('./i18n.js')
const $ = require('jquery')

class IrcServerViewController extends EventEmitter {
  constructor (client, ctcpClient) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient

    this.client.on('connecting', (hostName, port) => {
      this.displayText(__('CONNECTING_TO', hostName, port), 'client-event')
      this.displaySeperator()
    })

    this.client.on('disconnected', (reason) => {
      this.displayText(__('DISCONNECTED', reason), 'client-event')
      this.displaySeperator()
    })

    this.client.on('connected', () => {
      this.client.localUser.on('notice', (source, targets, noticeText) => {
        let channelUsers = this.client.localUser.getChannelUsers()
        if (channelUsers.length === 0) {
          this.displayMessage(source, noticeText, true)
        }
      })
    })

    this.client.on('error', errorMessage => {
      this.displayError('* ' + errorMessage)
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
      this.displayText(__('MOTD_TITLE', this.client.serverName))
      messageOfTheDay
        .split('\r\n')
        .forEach(line => this.displayText(line))
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
      if (networkInfo.visibleUsersCount !== undefined &&
          networkInfo.invisibleUsersCount !== undefined &&
          networkInfo.serversCount !== undefined &&
          networkInfo.channelsCount !== undefined &&
          networkInfo.serverClientsCount !== undefined &&
          networkInfo.serverServersCount !== undefined) {
        // First display when all information been recieved.
        this.displayText(__('NETWORK_INFO_1', 
          networkInfo.visibleUsersCount, networkInfo.invisibleUsersCount, networkInfo.serversCount))
        this.displayText(__('NETWORK_INFO_2', networkInfo.channelsCount))
        this.displayText(__('NETWORK_INFO_3', networkInfo.serverClientsCount, networkInfo.serverServersCount))
        this.displaySeperator()
      }
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
      if (message.tag != 'ACTION') {
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

  focusInput(message = null) {
    let input = this.serverToolbar.find('.chat-input')
    if (message) {
      input.val(message)
    }
    input.focus()
  }

  displayText (text, messageClass) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, { 
      isServer: true, isAction: true, detectLinks: false, class: messageClass
    })
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

  displayMessage (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(null, text, { isServer: true })
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

    if (text[0] === '/') {
      this.sendAction(text.trim())
    } else {
      this.displayMessage(null, __('NOT_ON_A_CHANNEL'))
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
      case 'nick':
        this.client.setNickName(content)
        break
      default:
        this.displayMessage(null, __('UNKNOWN_COMMAND'))
        break
    }
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

    inputhistory(input)
  }
}

module.exports = IrcServerViewController

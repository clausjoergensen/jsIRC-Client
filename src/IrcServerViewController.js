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
const $ = require('jquery')

class IrcServerViewController extends EventEmitter {
  constructor (client, ctcpClient) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient

    this.client.on('connecting', (hostName, port) => {
      this.displayText(`* Connecting to ${hostName} (${port})`, 'client-event')
      this.displaySeperator()
    })

    this.client.on('disconnected', (reason) => {
      this.displayText(`* Disconnected (${reason})`, 'client-event')
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
      this.displayText(`${hostName} is now your displayed host.`)
      this.displaySeperator()
    })

    this.client.on('clientInfo', (welcomeMessage) => {
      this.displayText(this.client.welcomeMessage || '')
      this.displayText(this.client.yourHostMessage || '')
      this.displayText(this.client.serverCreatedMessage || '')
      this.displaySeperator()
    })

    this.client.on('whoIsReply', (user) => {
      this.displayText(`${user.nickName} is ${user.userName}@${user.hostName} * ${user.realName}`)

      let channels = user.getChannelUsers().map(cu => cu.channel.name).join(' ')
      this.displayText(`${user.nickName} is on ${channels}`)

      if (user.isAway) {
        this.displayText(`${user.nickName} is away: ${user.awayMessage}`)
      }

      this.displayText(`${user.nickName} is using ${user.serverName} ${user.serverInfo}`)

      if (user.idleDuration > 0) {
        this.displayText(`${user.nickName} is has been idle ${prettyMs(user.idleDuration * 1000, { verbose: true })}`)
      }

      this.displayText(`${user.nickName} End of /WHOIS list.`)
      this.displaySeperator()
    })

    this.client.on('motd', messageOfTheDay => {
      this.displayText(` - ${this.client.serverName} Message of the Day - `)
      messageOfTheDay
        .split('\r\n')
        .forEach(line => this.displayText(line))
      this.displaySeperator()
    })

    this.client.on('connectionError', error => {
      if (error.code === 'ECONNREFUSED') {
        this.displayError(`* Couldn't connect to server (Connection refused)`, 'client-event')
      } else if (error.code === 'ECONNRESET') {
        this.displayText(`* Disconnected (Connection Reset)`, 'client-event')
      } else if (error.code === 'ENOTFOUND') {
        this.displayError(`* Unable to resolve server`, 'client-event')
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
        this.displayText(`There are ${networkInfo.visibleUsersCount} users and ${networkInfo.invisibleUsersCount} invisible on ${networkInfo.serversCount} servers`)
        this.displayText(`${networkInfo.channelsCount} channels formed`)
        this.displayText(`I have ${networkInfo.serverClientsCount} clients and ${networkInfo.serverServersCount} servers`)
        this.displaySeperator()
      }
    })

    this.client.on('serverTime', (server, dateTime) => {
      this.displayText(dateTime)
      this.displaySeperator()
    })

    this.ctcpClient.on('ping', (source, pingTime) => {
      this.displayAction(`[${source.nickName} PING reply]: ${pingTime} seconds.`)
    })

    this.ctcpClient.on('time', (source, dateTime) => {
      this.displayAction(`[${source.nickName} TIME reply]: ${dateTime}.`)
    })

    this.ctcpClient.on('version', (source, versionInfo) => {
      this.displayAction(`[${source.nickName} VERSION reply]: ${versionInfo}.`)
    })

    this.ctcpClient.on('finger', (source, info) => {
      this.displayAction(`[${source.nickName} FINGER reply]: ${info}.`)
    })

    this.ctcpClient.on('clientInfo', (source, info) => {
      this.displayAction(`[${source.nickName} CLIENTINFO reply]: ${info}.`)
    })

    this.ctcpClient.on('rawMessageSent', (message) => {
      if (message.tag != 'ACTION') {
        this.displayAction(`[${message.targets[0]} ${message.tag}]`)
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
      this.sendAction(text)
    } else {
      this.displayMessage(null, '* You are not on a channel')
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
        this.displayMessage(null, '* Unknown Command')
        break
    }
  }

  createServerView () {
    const serverMenu = Menu.buildFromTemplate([
      {
        label: 'Network Info',
        click: () => {
          this.client.getNetworkInfo()
        }
      },
      {
        label: 'Time',
        click: () => {
          this.client.getServerTime()
        }
      },
      {
        label: 'Message of the Day',
        click: () => {
          this.client.getMessageOfTheDay()
        }
      },
      { type: 'separator' },
      {
        label: `Quit jsIRC`,
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
      'placeholder': 'Send Message …',
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

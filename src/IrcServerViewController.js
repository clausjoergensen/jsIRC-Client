// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, app } = remote

const events = require('events')
const { EventEmitter } = events

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
      this.client.localUser.on('message', (source, targets, messageText) => {
        this.displayMessage(source, messageText)
      })

      this.client.localUser.on('notice', (source, targets, noticeText) => {
        this.displayNotice(source, noticeText)
      })
    })

    this.client.on('error', errorMessage => {
      this.displayError('* ' + errorMessage)
    })

    this.client.on('clientInfo', (welcomeMessage) => {
      this.displayText(this.client.welcomeMessage || '')
      this.displayText(this.client.yourHostMessage || '')
      this.displayText(this.client.serverCreatedMessage || '')
      this.displaySeperator()
      this.displayText(`${this.client.localUser.hostName} is now your displayed host.`)
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
        this.displayText(`* Unable to resolve server`, 'client-event')
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
      this.displayAction(`[${message.targets[0]} ${message.tag}]`)
    })

    this.createServerView()
  }

  show () {
    this.serverView.css('display', 'block')
    this.serverView.scrollTop(this.serverView.scrollHeight)
    this.serverToolbar.css('display', 'block')
    this.serverToolbar.find('.chat-input')[0].focus()
  }

  hide () {
    this.serverView.css('display', 'none')
    this.serverToolbar.css('display', 'none')
  }

  displayAction (text) {
    this.displayText(text)
    this.displaySeperator()
  }

  displayError (text) {
    this.displayText(text)
    this.displaySeperator()
  }

  displayMessage (source, text, styles = []) {
    let senderName = ''
    if (source) {
      if (source.nickName) {
        senderName = `<${source.nickName}>`
      } else if (source.hostName) {
        senderName = source.hostName
      }
    }

    this.displayText(`${senderName} ${text}`)
  }

  displayNotice (source, text) {
    let senderName = ''
    if (source) {
      if (source.nickName) {
        senderName = ` - ${source.nickName} -`
      } else if (source.hostName) {
        senderName = source.hostName
      }
    }

    this.displayText(`${senderName} ${text}`)
    this.displaySeperator()
  }

  displayText (text, messageClass = null) {
    text = text.replace(/[^\x20-\xFF]/g, '')

    let now = new Date()

    let paragraph = $('<p />', { 'class': 'server-message' })
    if (messageClass) {
      paragraph.addClass(messageClass)
    }

    let timestamp = $('<span />', {
      'class': 'timestamp',
      'text': `[${strftime('%H:%M', now)}]`
    }).appendTo(paragraph)

    paragraph.append(document.createTextNode(` ${text}`))

    this.serverView.append(paragraph)
    this.serverView.scrollTop(this.serverView.scrollHeight)

    this.markAsUnread()
  }

  displaySeperator () {
    let paragraph = $('<p />', { 'class': 'server-message seperator', 'text': '-' })

    this.serverView.append(paragraph)
    this.serverView.scrollTop(this.serverView.scrollHeight)
  }

  markAsUnread () {
    let network = Array.from(
      document.getElementById('network-list').querySelectorAll('ul.network')
    ).find(x => x.clientId == this.client.id)

    if (network && !network.firstChild.classList.contains('network-selected')) {
      network.firstChild.classList.add('nav-unread')
    }
  }

  sendUserInput (text) {
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
    let rightColumn = $('#right-column')

    let serverView = $('<div />', {
      'class': 'server-view',
      'style': 'display: none'
    }).appendTo(rightColumn)

    let serverToolbar = $('<div />', {
      class: 'toolbar toolbar-footer',
      style: 'height: 40px; display: none'
    }).appendTo(rightColumn)

    let input = $('<input />', {
      'type': 'text',
      'class': 'chat-input',
      'placeholder': 'Send Message …',
      'autofocus': true
    }).appendTo(serverToolbar)

    input.keyup((e) => {
      if (e.keyCode === 13) {
        this.sendUserInput(input.val())
        input.val('')
      }        
    })
    
    inputhistory(input)

    const serverMenuTemplate = [
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
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ]

    const serverMenu = Menu.buildFromTemplate(serverMenuTemplate)

    serverView.on('contextmenu', (e) => {
      e.preventDefault()
      serverMenu.popup({ window: remote.getCurrentWindow() })
    }, false)

    this.serverView = serverView
    this.serverToolbar = serverToolbar
  }
}

module.exports = IrcServerViewController

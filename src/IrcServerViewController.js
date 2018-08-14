// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, app } = remote

const events = require('events')
const { EventEmitter } = events

const strftime = require('strftime')
const prettyMs = require('pretty-ms')

class IrcServerViewController extends EventEmitter {
  constructor (client, ctcpClient) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient

    this.client.on('connecting', (hostName, port) => {
      this.displayText(`* Connecting to ${hostName} (${port})`)
      this.displaySeperator()
    })

    this.client.on('disconnected', (reason) => {
      this.displayText(`* Disconnected (${reason})`)
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

    this.client.on('protocolError', (command, errorName, errorParameters, errorMessage) => {
      switch (command) {
        case 433: // ERR_NICKNAMEINUSE
          this.displayError(`Nickname '${errorParameters[0]}' is already in use.`)
          break
      }
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
        this.displayError(`* Couldn't connect to server (Connection refused)`)
      } else if (error.code === 'ECONNRESET') {
        this.displayText(`* Disconnected (Connection Reset)`)
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
    this.serverView.style.display = 'block'
    this.serverView.scrollTop = this.serverView.scrollHeight
  }

  hide () {
    this.serverView.style.display = 'none'
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

  displayText (text) {
    text = text.replace(/[^\x20-\xFF]/g, '')

    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${text}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('server-message')
    paragraph.innerText = formattedText

    this.serverView.appendChild(paragraph)
    this.serverView.scrollTop = this.serverView.scrollHeight

    this.markAsUnread()
  }

  displaySeperator () {
    let paragraph = document.createElement('p')
    paragraph.classList.add('server-message')
    paragraph.classList.add('seperator')
    paragraph.innerText = '-'

    this.serverView.appendChild(paragraph)
    this.serverView.scrollTop = this.serverView.scrollHeight
  }

  markAsUnread () {
    let network = Array.from(
      document.getElementById('network-list').querySelectorAll('ul.network')
    ).find(x => x.clientId == this.client.id)

    if (network && !network.firstChild.classList.contains('network-selected')) {
      network.firstChild.classList.add('nav-unread')
    }
  }

  createServerView () {
    let serverView = document.createElement('div')
    serverView.classList.add('server-view')
    serverView.style.display = 'none'

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

    serverView.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      serverMenu.popup({ window: remote.getCurrentWindow() })
    }, false)

    document.getElementById('right-column').appendChild(serverView)

    this.serverView = serverView
  }
}

module.exports = IrcServerViewController

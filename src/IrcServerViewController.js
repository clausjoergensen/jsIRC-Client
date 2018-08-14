// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, app } = remote

const events = require('events')
const { EventEmitter } = events

const strftime = require('strftime')

class IrcServerViewController extends EventEmitter {
  constructor (client, ctcpClient) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient

    this.client.on('connecting', (hostName, port) => {
      this.displayMessage(null, `* Connecting to ${hostName} (${port})`)
    })

    this.client.on('disconnected', (reason) => {
      this.displayMessage(null, `* Disconnected (${reason})`)
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

    this.client.on('motd', messageOfTheDay => {
      this.displayMessage(null, ` - ${this.client.serverName} Message of the Day - `)
      messageOfTheDay
        .split('\r\n')
        .forEach(l => this.displayMessage(null, l))
    })

    this.client.on('connectionError', error => {
      if (error.code === 'ECONNREFUSED') {
        this.displayError(`* Couldn't connect to server (Connection refused)`)
      } else if (error.code === 'ECONNRESET') {
        this.displayMessage(null, `* Disconnected (Connection Reset)`)
      } else {
        console.error(error)
      }
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

    this.createServerView()
  }

  show () {
    this.serverView.style.display = 'block'
  }

  hide () {
    this.serverView.style.display = 'none'
  }

  displayAction (text) {
    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${text}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('server-message')
    paragraph.innerText = formattedText

    this.serverView.appendChild(paragraph)
    this.serverView.scrollTop = this.serverView.scrollHeight
  }

  displayError (text) {
    this.displayMessage(null, text, ['server-error'])
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

    text = text.replace(/[^\x20-\xFF]/g, '')

    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${senderName} ${text}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('server-message')
    paragraph.innerText = formattedText

    styles.forEach(s => paragraph.classList.add(s))

    this.serverView.appendChild(paragraph)
    this.serverView.scrollTop = this.serverView.scrollHeight
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

    text = text.replace(/[^\x20-\xFF]/g, '')

    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${senderName} ${text}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('server-message')
    paragraph.innerText = formattedText

    this.serverView.appendChild(paragraph)
    this.serverView.scrollTop = this.serverView.scrollHeight
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

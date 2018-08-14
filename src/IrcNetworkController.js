// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, BrowserWindow, app } = remote

const events = require('events')
const { EventEmitter } = events

class IrcNetworkController extends EventEmitter {
  constructor (client) {
    super()

    this.client = client
    this.channels = {}
    this.serverView = null

    client.once('clientInfo', () => {
      this.addServerToList()
    })

    client.on('connected', () => {
      client.localUser.on('nickName', () => {
        if (this.serverView) {
          console.log(this.networkName)
          this.serverView.firstChild.innerText =
            `${this.networkName || this.client.serverName} (${this.client.localUser.nickName})`
        }
        this.setWindowTitleForServer(this.networkName)
      })

      client.localUser.on('joinedChannel', (channel) => {
        channel.on('message', (source, messageText) => {
          this.markAsUnread(channel)
        })

        channel.on('action', (source, messageText) => {
          this.markAsUnread(channel)
        })

        channel.on('topic', (source, topic) => {
          this.setWindowTitleForChannel(channel)
          this.markAsUnread(channel)
        })

        this.addChannelToList(channel)
        this.viewChannel(channel)
      })

      client.localUser.on('partedChannel', (channel) => {
        let channelView = this.channels[channel.name].channelView
        channelView.parentElement.removeChild(channelView)

        if (Object.keys(this.channels).length === 0) {
          this.viewServer()
        } else if (this.selectedChannel === channel) {
          let previousChannel = this.getPreviousChannel(channel)
          if (previousChannel) {
            this.viewChannel(previousChannel)
          } else {
            let nextChannel = this.getNextChannel(channel)
            if (nextChannel) {
              this.viewChannel(nextChannel)
            } else {
              this.viewServer()
            }
          }
        }

        delete this.channels[channel.name]
      })
    })

    client.on('serverSupportedFeatures', (serverSupportedFeatures) => {
      let networkName = serverSupportedFeatures['NETWORK']
      if (networkName) {
        this.networkName = networkName
        this.serverView.firstChild.innerText = `${this.networkName} (${this.client.localUser.nickName})`
        this.setWindowTitleForServer(this.networkName)
      }
    })
  }

  get selectedChannel () {
    return this.selectedView ? this.selectedView.channel : null
  }

  getPreviousChannel (channel) {
    let keys = Object.keys(this.channels)
    let index = keys.indexOf(channel.name)
    if (index > 0) {
      return this.channels[keys[index - 1]].channel
    }
    return null
  }

  getNextChannel (channel) {
    let keys = Object.keys(this.channels)
    let index = keys.indexOf(channel.name)
    if (index < (keys.length - 1)) {
      return this.channels[keys[index + 1]].channel
    }
    return null
  }

  viewChannel (channel) {
    Array.from(document.getElementsByClassName('network'))
      .forEach(e => e.classList.remove('network-selected'))

    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].channelView.classList.remove('channel-selected')
    })

    this.channels[channel.name].channelView.classList.remove('nav-unread')
    this.channels[channel.name].channelView.classList.add('channel-selected')

    this.selectedView = this.channels[channel.name].channelView
    this.setWindowTitleForChannel(channel)

    this.emit('viewChannel', this.client, channel)
  }

  viewServer () {
    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].channelView.classList.remove('channel-selected')
    })

    Array.from(document.getElementsByClassName('network'))
      .forEach(e => e.classList.remove('network-selected'))

    this.serverView.firstChild.classList.remove('nav-unread')
    this.serverView.firstChild.classList.add('network-selected')

    this.selectedView = this.serverView
    this.setWindowTitleForServer()

    this.emit('viewServer', this.client, this.client.serverName)
  }

  addServerToList () {
    if (this.serverView) {
      return
    }

    let serverListElement = document.createElement('ul')
    serverListElement.classList.add('network')

    let serverListItemElement = document.createElement('li')
    serverListItemElement.classList.add('network')
    serverListItemElement.innerText = `${this.client.serverName} (${this.client.localUser.nickName})`

    serverListElement.appendChild(serverListItemElement)

    let networkListElement = document.getElementById('network-list')
    networkListElement.appendChild(serverListElement)

    serverListItemElement.addEventListener('click', (e) => {
      e.preventDefault()
      this.viewServer()
    }, false)

    this.serverView = serverListElement
  }

  addChannelToList (channel) {
    if (this.channels[channel.name]) {
      return
    }

    let channelElement = document.createElement('li')
    channelElement.classList.add('channel')
    channelElement.channel = channel
    channelElement.innerText = channel.name

    const channelMenu = Menu.buildFromTemplate([{
      label: 'Leave Channel',
      click: () => {
        channel.part()
      }
    }])

    channelElement.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      channelMenu.popup({ window: remote.getCurrentWindow() })
    }, false)

    channelElement.addEventListener('click', (e) => {
      e.preventDefault()
      this.viewChannel(channel)
    }, false)

    this.serverView.appendChild(channelElement)

    this.channels[channel.name] = {
      'channel': channel,
      'channelView': channelElement
    }
  }

  setWindowTitleForServer (networkName = null) {
    let userModes = this.client.localUser.modes.join('')
    userModes = userModes.length > 0 ? `+${userModes}` : ''

    let serverName = networkName || this.client.serverName

    let browserWindow = BrowserWindow.getFocusedWindow()
    if (browserWindow) {
      browserWindow.setTitle(
        `${app.getName()} - [Status: ${this.client.localUser.nickName} [${userModes}] on ${serverName} (${this.client.hostName}:${this.client.port})]`)
    }
  }

  setWindowTitleForChannel (channel) {
    let topic = channel.topic ? `: ${channel.topic}` : ''

    let serverName = this.client.serverSupportedFeatures['NETWORK']
    serverName = serverName || this.client.serverName

    let browserWindow = BrowserWindow.getFocusedWindow()
    if (browserWindow) {
      browserWindow.setTitle(`${app.getName()} - [${channel.name} (${serverName}, ${this.client.localUser.nickName})${topic}]`)
    }
  }

  markAsUnread (channel = null) {
    if (!channel) {
      this.serverView.firstChild.classList.add('nav-unread')
    } else {
      this.serverView.firstChild.classList.remove('nav-unread')
      if (this.selectedChannel !== channel) {
        this.channels[channel.name].channelView.classList.add('nav-unread')
      }
    }
  }
}

module.exports = IrcNetworkController

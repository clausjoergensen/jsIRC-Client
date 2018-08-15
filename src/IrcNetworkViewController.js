// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, BrowserWindow, app } = remote

const events = require('events')
const { EventEmitter } = events

const $ = require('jquery')

class IrcNetworkViewController extends EventEmitter {
  constructor (client) {
    super()

    this.client = client
    this.channels = {}
    this.serverView = null

    client.once('connecting', () => {
      this.addServerToList()
    })

    client.on('connected', () => {
      client.localUser.on('nickName', () => {
        if (this.serverView) {
          this.serverTitle.text(`${this.networkName || this.client.serverName} (${this.client.localUser.nickName})`)
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
        channelView.remove()

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
        this.serverTitle.text(`${this.networkName} (${this.client.localUser.nickName})`)
        this.setWindowTitleForServer(this.networkName)
      }
    })
  }

  get selectedChannel () {
    return this.selectedView ? this.selectedView.channel : null
  }

  deselect () {
    this.selectedView = null
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
    $('.network').removeClass('network-selected')
    $('.channel').removeClass('channel-selected')

    this.channels[channel.name].channelView.removeClass('nav-unread')
    this.channels[channel.name].channelView.addClass('channel-selected')

    this.selectedView = this.channels[channel.name].channelView
    this.setWindowTitleForChannel(channel)

    this.emit('viewChannel', this.client, channel)
  }

  viewServer () {
    $('.network').removeClass('network-selected')
    $('.channel').removeClass('channel-selected')

    this.serverTitle.removeClass('nav-unread')
    this.serverTitle.addClass('network-selected')

    this.selectedView = this.serverView
    this.setWindowTitleForServer()

    this.emit('viewServer', this.client)
  }

  addServerToList () {
    if (this.serverView) {
      return
    }

    this.serverView = $('<ul />', {
      'class': 'network'
    }).appendTo($('#network-list'))

    this.serverView.data('clientId', this.client.id)

    this.serverTitle = $('<li />', {
      'class': 'network',
      'text': this.client.hostName,
      'click': (e) => {
        e.preventDefault()
        this.viewServer()
      },
      'contextmenu': (e) => {
        e.preventDefault()
        let serverMenu = Menu.buildFromTemplate([{
          label: `Leave ${this.client.serverSupportedFeatures['NETWORK'] || this.client.serverName}`,
          click: () => {
            this.client.quit()
            this.serverView.remove()
            Object.keys(this.channels).forEach((key, index) => {
              this.channels[key].channelView.remove()
            })
            this.emit('quit', this.client)
          }
        }])
        serverMenu.popup({ window: remote.getCurrentWindow() })
      },
    }).appendTo(this.serverView)

    this.client.once('clientInfo', () => {
      this.serverTitle.text(`${this.client.serverName} (${this.client.localUser.nickName})`)
    })
  }

  addChannelToList (channel) {
    if (this.channels[channel.name]) {
      return
    }

    const channelMenu = Menu.buildFromTemplate([{
      label: 'Leave Channel',
      click: () => {
        channel.part()
      }
    }])

    let channelView = $('<li />', {
      'class': 'channel',
      'text': channel.name,
      'contextmenu': (e) => {
        e.preventDefault()
        channelMenu.popup({ window: remote.getCurrentWindow() })
      },
      'click': (e) => {
        e.preventDefault()
        this.viewChannel(channel)
      }
    }).appendTo(this.serverView)

    channelView.data('channel', channel)

    this.channels[channel.name] = {
      'channel': channel,
      'channelView': channelView
    }
  }

  setWindowTitleForServer (networkName = null) {
    let userModes = ''
    if (this.client.localUser) {
      userModes = this.client.localUser.modes.join('')
      userModes = userModes.length > 0 ? `[+${userModes}]` : ''
    }

    let serverName = networkName || this.client.serverName

    let browserWindow = BrowserWindow.getFocusedWindow()
    if (browserWindow) {
      let nickName = this.client.localUser ? this.client.localUser.nickName : this.client.registrationInfo.nickName
      browserWindow.setTitle(
        `${app.getName()} - [Status: ${nickName} ${userModes} on ${serverName} (${this.client.hostName}:${this.client.port})]`)
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
      this.serverTitle.addClass('nav-unread')
    } else {
      this.serverTitle.removeClass('nav-unread')
      if (this.selectedChannel !== channel) {
        this.channels[channel.name].channelView.addClass('nav-unread')
      }
    }
  }
}

module.exports = IrcNetworkViewController

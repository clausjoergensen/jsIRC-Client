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
    this.users = {}
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

      client.localUser.on('message',  (source, targets, noticeText) => {
        if (this.users[source.nickName]) {
          let user = this.users[source.nickName]
          if (this.selectedUser !== user.user) {
            this.users[source.nickName].userView.addClass('nav-unread')
          }
        } else {
          this.addUserToList(source) 
        }
      })

      client.localUser.on('notice', (source, targets, noticeText) => {
        let keys = Object.keys(this.channels)
        if (keys.length > 0) {
          keys.forEach(key => {
            let channel = this.channels[key]
            if (this.selectedChannel !== channel.channel) {
              channel.channelView.addClass('nav-unread')
            }
          })
        } else {
          this.markAsUnread()
        }
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
    return this.selectedView ? this.selectedView.data('channel') : null
  }

  get selectedUser () {
    return this.selectedView ? this.selectedView.data('user') : null
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

  viewUser (user) {
    $('.network').removeClass('network-selected')
    $('.channel').removeClass('channel-selected')
    $('.user').removeClass('user-selected')    

    this.users[user.nickName].userView.removeClass('nav-unread')
    this.users[user.nickName].userView.addClass('user-selected')

    this.selectedView = this.users[user.name].userView
    this.setWindowTitleForUser(user)

    this.emit('viewUser', this.client, user)
  }

  hideUser (user) {
    this.users[user.nickName].userView.remove()
    delete this.users[user.nickName]

    let keys = Object.keys(this.channels)
    if (keys.length > 0) {
      this.viewChannel(this.channels[keys[0]].channel)
    } else {
      this.viewServer()
    }

    this.emit('hideUser', this.client, user)
  }

  viewChannel (channel) {
    $('.network').removeClass('network-selected')
    $('.channel').removeClass('channel-selected')
    $('.user').removeClass('user-selected')

    this.channels[channel.name].channelView.removeClass('nav-unread')
    this.channels[channel.name].channelView.addClass('channel-selected')

    this.selectedView = this.channels[channel.name].channelView
    this.setWindowTitleForChannel(channel)

    this.emit('viewChannel', this.client, channel)
  }

  viewServer () {
    $('.network').removeClass('network-selected')
    $('.channel').removeClass('channel-selected')
    $('.user').removeClass('user-selected')

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

  addUserToList (user) {
    if (this.users[user.nickName]) {
      return
    }

    const userMenu = Menu.buildFromTemplate([{
      label: 'Close',
      click: () => {
        this.hideUser(user)
      }
    }])

    let userView = $('<li />', {
      'class': 'user nav-unread',
      'text': user.nickName,
      'contextmenu': (e) => {
        e.preventDefault()
        userMenu.popup({ window: remote.getCurrentWindow() })
      },
      'click': (e) => {
        e.preventDefault()
        this.viewUser(user)
      }
    }).appendTo(this.serverView)

    userView.data('user', user)

    this.users[user.nickName] = {
      'user': user,
      'userView': userView
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

  setWindowTitleForUser (user) {
    let serverName = this.client.serverSupportedFeatures['NETWORK']
    serverName = serverName || this.client.serverName

    let browserWindow = BrowserWindow.getFocusedWindow()
    if (browserWindow) {
      browserWindow.setTitle(`${app.getName()} - [${user.nickName} (${serverName}, ${this.client.localUser.nickName})]`)
    }    
  }

  markAsUnread (channel = null) {
    if (!channel) {
      this.serverTitle.addClass('nav-unread')
    } else {
      if (this.selectedChannel !== channel) {
        this.channels[channel.name].channelView.addClass('nav-unread')
      }
    }
  }
}

module.exports = IrcNetworkViewController

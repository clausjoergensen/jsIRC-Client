// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu } = remote

const events = require('events')
const { EventEmitter } = events

const strftime = require('strftime')
const Autolinker = require('autolinker')
const prompt = require('electron-prompt')

class IrcChannelViewController extends EventEmitter {
  constructor (client, ctcpClient, channel) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient
    this.channel = channel

    this.channelView = null
    this.messageView = null
    this.titleView = null

    channel.on('message', (source, messageText) => {
      this.displayMessage(channel, source, messageText)
    })

    channel.on('action', (source, messageText) => {
      this.displayMessage(channel, null, `* ${source.nickName} ${messageText}`)
    })

    channel.on('topic', (source, topic) => {
      this.displayTopic(channel, source)
    })

    channel.once('userList', () => {
      channel.users.forEach(channelUser => {
        channelUser.user.on('nickName', () => {
          this.displayUsers(channel)
        })

        channelUser.on('modes', () => {
          this.displayUsers(channel)
        })
      })
      this.displayUsers(channel)
    })

    channel.on('userJoinedChannel', (channelUser) => {
      channelUser.user.on('nickName', () => {
        this.displayUsers(channelUser.channel)
      })
      channelUser.on('modes', () => {
        this.displayUsers(channelUser.channel)
      })
      this.displayUsers(channel)
    })

    channel.on('userLeftChannel', (channelUser) => {
      this.displayUsers(channel)
    })

    channel.on('userKicked', (_) => {
      this.displayUsers(channel)
    })

    this.createChannelView()
  }

  get name () {
    return this.channel.name
  }

  show () {
    this.channelView.style.display = 'table'
  }

  hide () {
    this.channelView.style.display = 'none'
  }

  sendMessage (message) {
    this.channel.sendMessage(message)
  }

  part () {
    this.channel.part()
  }

  displayError (errorMessage) {
    let senderName = '* ' + this.client.localUser.nickName
    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${senderName}: ${errorMessage}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('channel-message')
    paragraph.classList.add('channel-message-error')
    paragraph.innerText = formattedText

    this.messageView.appendChild(paragraph)
    this.messageView.scrollTop = this.messageView.scrollHeight
  }

  displayAction (channelName, source, text) {
    text = text.replace(/[^\x20-\xFF]/g, '')

    let linkedText = Autolinker.link(text, {
      stripPrefix: false,
      newWindow: false,
      replaceFn: (match) => {
        if (match.getType() === 'url') {
          var tag = match.buildTag()
          tag.setAttr('title', match.getAnchorHref())
          return tag
        } else {
          return true
        }
      }
    })

    let senderName = '* ' + source.nickName
    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${senderName} ${linkedText}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('channel-message')
    paragraph.innerHTML = formattedText

    this.messageView.appendChild(paragraph)
    this.messageView.scrollTop = this.messageView.scrollHeight
  }

  displayMessage (channel, source, text) {
    let senderName = ''
    if (source) {
      if (source.nickName) {
        senderName = `&lt;${source.nickName}&gt;`
      } else if (source.hostName) {
        senderName = source.hostName
      }
    }

    text = text.replace(/[\x00-\x1F]/g, '') // eslint-disable-line no-control-regex

    let linkedText = Autolinker.link(text, {
      stripPrefix: false,
      newWindow: false,
      replaceFn: (match) => {
        if (match.getType() === 'url') {
          var tag = match.buildTag()
          tag.setAttr('title', match.getAnchorHref())
          return tag
        } else {
          return true
        }
      }
    })

    let now = new Date()
    let formattedText = `[${strftime('%H:%M', now)}] ${senderName} ${linkedText}`

    let paragraph = document.createElement('p')
    paragraph.classList.add('channel-message')
    paragraph.innerHTML = formattedText

    this.messageView.appendChild(paragraph)
    this.messageView.scrollTop = this.messageView.scrollHeight
  }

  displayTopic (channel, source = null) {
    if (channel.topic == null || channel.topic.length === 0) {
      this.titleView.innerHTML = '(No Channel Topic)'
    } else {
      this.titleView.innerHTML = Autolinker.link(channel.topic, {
        stripPrefix: false,
        newWindow: false,
        replaceFn: (match) => {
          if (match.getType() === 'url') {
            var tag = match.buildTag()
            tag.setAttr('title', match.getAnchorHref())
            return tag
          } else {
            return true
          }
        }
      })
    }

    if (source) {
      this.displayAction(channel.name, source, `changed topic to '${channel.topic}'`)
    }
  }

  displayUsers (channel) {
    while (this.usersView.firstChild) {
      this.usersView.removeChild(this.usersView.firstChild)
    }

    let sortedUsers = channel.users.sort((a, b) => {
      if (a.modes.includes('q') && b.modes.includes('q')) {
        return a.user.nickName.localeCompare(b.user.nickName)
      } else if (a.modes.includes('q')) {
        return -1
      } else if (b.modes.includes('q')) {
        return 1
      }

      if (a.modes.includes('a') && b.modes.includes('a')) {
        return a.user.nickName.localeCompare(b.user.nickName)
      } else if (a.modes.includes('a')) {
        return -1
      } else if (b.modes.includes('a')) {
        return 1
      }

      if (a.modes.includes('o') && b.modes.includes('o')) {
        return a.user.nickName.localeCompare(b.user.nickName)
      } else if (a.modes.includes('o')) {
        return -1
      } else if (b.modes.includes('o')) {
        return 1
      }

      if (a.modes.includes('h') && b.modes.includes('h')) {
        return a.user.nickName.localeCompare(b.user.nickName)
      } else if (a.modes.includes('h')) {
        return -1
      } else if (b.modes.includes('h')) {
        return 1
      }

      if (a.modes.includes('v') && b.modes.includes('v')) {
        return a.user.nickName.localeCompare(b.user.nickName)
      } else if (a.modes.includes('v')) {
        return -1
      } else if (b.modes.includes('v')) {
        return 1
      }

      return a.user.nickName.localeCompare(b.user.nickName)
    })

    sortedUsers.forEach(channelUser => {
      let user = channelUser.user

      const userMenu = Menu.buildFromTemplate([
        {
          label: 'Info',
          click: () => {
            this.ctcpClient.finger([user.nickName])
          }
        },
        {
          label: 'Whois',
          click: () => {
            this.client.queryWhoIs([user.nickName])
          }
        },
        { type: 'separator' },
        {
          label: 'Control',
          submenu: [
            {
              label: 'Op',
              click: () => {
                channelUser.op()
              }
            },
            {
              label: 'Deop',
              click: () => {
                channelUser.deop()
              }
            },
            {
              label: 'Voice',
              click: () => {
                channelUser.voice()
              }
            },
            {
              label: 'Devoice',
              click: () => {
                channelUser.devoice()
              }
            },
            {
              label: 'Kick',
              click: () => {
                channelUser.kick()
              }
            },
            {
              label: 'Kick (Why)',
              click: () => {
                prompt({
                  title: `Kick ${user.nickName}`,
                  label: 'Reason:'
                }).then((r) => {
                  if (r) {
                    channelUser.kick(r)
                  }
                }).catch(console.error)
              }
            },
            {
              label: 'Ban',
              click: () => {
                channelUser.ban()
              }
            },
            {
              label: 'Ban, Kick',
              click: () => {
                channelUser.ban()
                channelUser.kick()
              }
            },
            {
              label: 'Ban, Kick (Why)',
              click: () => {
                prompt({
                  title: `Ban & Kick ${user.nickName}`,
                  label: 'Reason:'
                }).then((r) => {
                  if (r) {
                    channelUser.ban()
                    channelUser.kick(r)
                  }
                }).catch(console.error)
              }
            }
          ]
        },
        {
          label: 'CTCP',
          submenu: [
            {
              label: 'Ping',
              click: () => {
                this.ctcpClient.ping([user.nickName])
                this.displayServerAction(`[${user.nickName} PING]`)
              }
            },
            {
              label: 'Time',
              click: () => {
                this.ctcpClient.time([user.nickName])
                this.displayServerAction(`[${user.nickName} TIME]`)
              }
            }, {
              label: 'Version',
              click: () => {
                this.ctcpClient.version([user.nickName])
                this.displayServerAction(`[${user.nickName} VERSION]`)
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Slap',
          click: () => {
            let slapMessage = `slaps ${user.nickName} around a bit with a large trout`
            this.ctcpClient.action([channel.name], slapMessage)
            this.displayAction(channel.name, this.client.localUser, slapMessage)
          }
        }
      ])

      let userElement = document.createElement('div')
      userElement.classList.add('user')
      userElement.addEventListener('contextmenu', (e) => {
        e.preventDefault()
        userMenu.popup({ window: remote.getCurrentWindow() })
      }, false)

      let userNameElement = document.createElement('span')
      userNameElement.classList.add('user-name')
      userNameElement.innerText = user.nickName

      let prefixElement = document.createElement('span')
      prefixElement.classList.add('user-mode')

      if (channelUser.modes.includes('q')) {
        prefixElement.classList.add('user-mode-owner')
        prefixElement.innerText = '~'
      } else if (channelUser.modes.includes('a')) {
        prefixElement.classList.add('user-mode-admin')
        prefixElement.innerText = '&'
      } else if (channelUser.modes.includes('o')) {
        prefixElement.classList.add('user-mode-op')
        prefixElement.innerText = '@'
      } else if (channelUser.modes.includes('h')) {
        prefixElement.classList.add('user-mode-halfop')
        prefixElement.innerText = '%'
      } else if (channelUser.modes.includes('v')) {
        prefixElement.classList.add('user-mode-voice')
        prefixElement.innerText = '+'
      } else {
        prefixElement.classList.add('user-mode-none')
        prefixElement.innerText = 'x'
      }

      userElement.appendChild(prefixElement)
      userElement.appendChild(userNameElement)

      this.usersView.appendChild(userElement)
    })
  }

  createChannelView (channel) {
    let channelTableView = document.createElement('table')
    channelTableView.style.display = 'none'
    channelTableView.cellSpacing = 0
    channelTableView.cellPadding = 0
    channelTableView.classList.add('channel-view')

    let row = channelTableView.insertRow()
    let messagesCell = row.insertCell()
    messagesCell.classList.add('messages-panel')

    let channelUsersView = row.insertCell()
    channelUsersView.classList.add('users-panel')

    let channelView = document.createElement('div')
    channelView.classList.add('channel-content-view')
    messagesCell.appendChild(channelView)

    let channelTitleView = document.createElement('div')
    channelTitleView.classList.add('channel-title-view')
    channelView.appendChild(channelTitleView)

    let channelTitleLabel = document.createElement('div')
    channelTitleLabel.classList.add('channel-title-label')
    channelTitleView.appendChild(channelTitleLabel)

    const channelTitleMenu = Menu.buildFromTemplate([{
      label: 'Set Topic',
      click: () => {
        this.showChannelModes(channel)
      }
    }])

    channelTitleLabel.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      channelTitleMenu.popup({ window: remote.getCurrentWindow() })
    }, false)

    let channelMessageView = document.createElement('div')
    channelMessageView.classList.add('channel-message-view')
    channelView.appendChild(channelMessageView)

    const channelMessageViewMenu = Menu.buildFromTemplate([{
      label: 'Channel Modes',
      click: () => {
        this.showChannelModes(channel)
      }
    }])

    channelMessageView.addEventListener('contextmenu', (e) => {
      e.preventDefault()
      channelMessageViewMenu.popup({ window: remote.getCurrentWindow() })
    }, false)

    this.channelView = channelTableView
    this.messageView = channelMessageView
    this.titleView = channelTitleLabel
    this.usersView = channelUsersView

    document.getElementById('right-column').appendChild(channelTableView)
  }
}

module.exports = IrcChannelViewController

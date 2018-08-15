// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu } = remote

const events = require('events')
const { EventEmitter } = events

const strftime = require('strftime')
const Autolinker = require('autolinker')
const inputhistory = require('./inputhistory.js')
const $ = require('jquery')

$.fn.onEnter = function (func) {
  this.bind('keypress', function (e) {
    if (e.keyCode === 13) {
      func.apply(this, [e])
    }
  })
  return this
}

class IrcChannelViewController extends EventEmitter {
  constructor (client, ctcpClient, channel) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient
    this.channel = channel

    this.channel.on('message', (source, messageText) => {
      this.displayMessage(source, messageText)
    })

    this.channel.on('action', (source, messageText) => {
      this.displayMessage(null, `* ${source.nickName} ${messageText}`)
    })

    this.channel.on('topic', (source, newTopic) => {
      this.displayTopic(source, newTopic)
    })

    this.channel.once('userList', () => {
      this.channel.users.forEach(channelUser => {
        channelUser.user.on('nickName', () => {
          this.displayUsers()
        })

        channelUser.on('modes', () => {
          this.displayUsers()
        })
      })
      this.displayUsers()
    })

    this.channel.on('userJoinedChannel', (channelUser) => {
      channelUser.user.on('nickName', () => {
        this.displayUsers()
      })
      channelUser.on('modes', () => {
        this.displayUsers()
      })
      this.displayUsers()
    })

    this.channel.on('userLeftChannel', (channelUser) => {
      this.displayUsers()
    })

    this.channel.on('userKicked', (_) => {
      this.displayUsers()
    })

    this.createChannelView()
    this.displayTopic()
    this.displayUsers()
  }

  get name () {
    return this.channel.name
  }

  setTopic (topic) {
    this.channel.setTopic(topic)
  }

  show () {
    this.channelView.css('display', 'block')
    this.channelToolbar.css('display', 'block')
    this.channelToolbar.find('.chat-input')[0].focus()
    this.scrollToBottom()
  }

  hide () {
    this.channelView.css('display', 'none')
    this.channelToolbar.css('display', 'none')
  }

  remove () {
    this.channelView.remove()
    this.channelToolbar.remove()
  }

  scrollToBottom () {
    this.messageView.scrollTop(this.messageView.prop('scrollHeight'))
  }

  part () {
    this.channel.part()
  }

  displayError (errorMessage) {
    let senderName = '* ' + this.client.localUser.nickName
    let now = new Date()

    let paragraph = $('<p />', {
      'class': 'channel-message channel-message-error'
    }).appendTo(this.messageView)

    $('<span />', {
      'class': 'timestamp',
      'text': `[${strftime('%H:%M', now)}]`
    }).appendTo(paragraph)

    paragraph.append(document.createTextNode(` ${senderName}: ${errorMessage}`))

    this.messageView.scrollTop(this.messageView.scrollHeight)
  }

  displayAction (source, text) {
    text = text.replace(/[^\x20-\xFF]/g, '')

    let linkedText = Autolinker.link(text, {
      stripPrefix: false,
      newWindow: false,
      replaceFn: (match) => {
        if (match.getType() === 'url') {
          let tag = match.buildTag()
          tag.setAttr('title', match.getAnchorHref())
          return tag
        } else {
          return true
        }
      }
    })

    let senderName = '* ' + source.nickName
    let now = new Date()
    let formattedText = `<span class="timestamp">[${strftime('%H:%M', now)}]</span> ${senderName} ${linkedText}`

    let paragraph = $('<p />', { 'class': 'channel-message' }).appendTo(this.messageView)
    paragraph.html(formattedText)

    this.messageView.scrollTop = this.messageView.scrollHeight
  }

  displayMessage (source, text) {
    let senderName = ''
    if (source) {
      if (source.nickName) {
        senderName = `&lt;${source.nickName}&gt;`
      } else if (source.hostName) {
        senderName = source.hostName
      }
    }

    let senderClass = ''
    if (source) {
      if (source.nickName) {
        senderClass = source.isLocalUser ? 'sender-me' : 'sender-other'
      } else if (source.hostName) {
        senderClass = 'sender-server'
      }
    }

    let messageClass = ''
    if (source) {
      if (source.nickName) {
        messageClass = source.isLocalUser ? 'message-by-me' : 'message-by-other'
      } else if (source.hostName) {
        senderClass = 'message-by-server'
      }
    }

    text = text.replace(/[\x00-\x1F]/g, '') // eslint-disable-line no-control-regex

    let linkedText = Autolinker.link(text, {
      stripPrefix: false,
      newWindow: false,
      replaceFn: (match) => {
        if (match.getType() === 'url') {
          let tag = match.buildTag()
          tag.setAttr('title', match.getAnchorHref())
          return tag
        } else {
          return true
        }
      }
    })

    let now = new Date()
    let formattedText = `<span class="timestamp">[${strftime('%H:%M', now)}]</span> <span class="${senderClass}">${senderName}</span> <span class="${messageClass}">${linkedText}</span>`

    let paragraph = $('<p />', { 'class': 'channel-message' }).appendTo(this.messageView)
    paragraph.html(formattedText)

    this.messageView.scrollTop(this.messageView.scrollHeight)
  }

  displayTopic (source = null, newTopic = null) {
    if (!newTopic) {
      this.titleView.html('(No Channel Topic)')
    } else {
      this.titleView.html(Autolinker.link(newTopic, {
        stripPrefix: false,
        newWindow: false,
        replaceFn: (match) => {
          if (match.getType() === 'url') {
            let tag = match.buildTag()
            tag.setAttr('title', match.getAnchorHref())
            return tag
          } else {
            return true
          }
        }
      }))
    }

    if (source) {
      this.displayAction(source, `changed topic to '${newTopic}'`)
    }
  }

  displayUsers () {
    while (this.usersView.firstChild) {
      this.usersView.removeChild(this.usersView.firstChild)
    }

    let sortedUsers = this.channel.users.sort((a, b) => {
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
                this.displayKickPrompt(channelUser)
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
                this.displayKickPrompt(channelUser, true)
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
              }
            },
            {
              label: 'Time',
              click: () => {
                this.ctcpClient.time([user.nickName])
              }
            }, {
              label: 'Version',
              click: () => {
                this.ctcpClient.version([user.nickName])
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Slap',
          click: () => {
            let slapMessage = `slaps ${user.nickName} around a bit with a large trout`
            this.ctcpClient.action([this.channel.name], slapMessage)
            this.displayAction(this.client.localUser, slapMessage)
          }
        }
      ])

      let userElement = $('<div />', {
        'class': 'user',
        'contextmenu': (e) => {
          e.preventDefault()
          userMenu.popup({ window: remote.getCurrentWindow() })
        }
      }).appendTo(this.usersView)

      $('<span />', {
        'class': 'user-name',
        text: user.nickName
      }).appendTo(userElement)

      let prefixElement = $('<span />', {
        'class': 'user-mode'
      }).appendTo(userElement)

      if (channelUser.modes.includes('q')) {
        prefixElement.addClass('user-mode-owner')
        prefixElement.text('~')
      } else if (channelUser.modes.includes('a')) {
        prefixElement.addClass('user-mode-admin')
        prefixElement.text('&')
      } else if (channelUser.modes.includes('o')) {
        prefixElement.addClass('user-mode-op')
        prefixElement.text('@')
      } else if (channelUser.modes.includes('h')) {
        prefixElement.addClass('user-mode-halfop')
        prefixElement.text('%')
      } else if (channelUser.modes.includes('v')) {
        prefixElement.addClass('user-mode-voice')
        prefixElement.text('+')
      } else {
        prefixElement.addClass('user-mode-none')
        prefixElement.text('x')
      }
    })
  }

  displayChannelModes () {
    let channelUser = this.channel.getChannelUser(this.client.localUser)
    let isChannelOperator = channelUser.modes.includes('o')

    // "Window"
    let inlineWindow = $('<div />', { 'id': 'channel-modes', 'class': 'prompt-window' }).appendTo('body')

    // Title
    $('<div />', {
      'class': 'prompt-title',
      'text': `${this.channel.name}`
    }).append(
      $('<span />', {
        'class': 'close',
        'click': () => inlineWindow.remove()
      })
    ).appendTo(inlineWindow)

    // Container
    let innerView = $('<div />', { 'style': 'padding: 10px' }).appendTo(inlineWindow)

    // Topic
    $('<div />', { 'text': 'Topic' }).appendTo(innerView)

    let topic = $('<input />', {
      'type': 'text',
      'value': this.channel.topic,
      'onEnter': (e) => {
        this.saveChannelModes(topic.val())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    // Channel Mode
    let template = document.querySelector('#template-channel-modes-table')
    $('<div />', { 'id': 'modes-box' })
      .append($('<div />', { 'text': 'Channel Mode' }))
      .append(document.importNode(template.content, true))
      .appendTo(innerView)

    $('#m-key').onEnter((e) => {
      this.saveChannelModes(topic.val())
      inlineWindow.remove()
    })

    $('#m-max-users').onEnter((e) => {
      this.saveChannelModes(topic.val())
      inlineWindow.remove()
    })

    // Ban List
    $('<div />', { 'text': 'Ban List' }).appendTo(innerView)

    let banList = $('<ul />', { 'id': 'ban-list' }).appendTo(innerView)

    // Buttons
    let unbanButton = $('<button />', {
      'text': 'Unban',
      'style': 'float: left; margin-left: 0px;',
      'disabled': 'disabled',
      'click': (e) => {
        if (!isChannelOperator) {
          return
        }
        let selected = $('#ban-list').find('.selected').first()
        let banMask = selected.data('banMask')
        this.channel.unban(banMask)
        selected.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': 'OK',
      'type': 'submit',
      'click': (e) => {
        this.saveChannelModes(topic.val())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': 'Cancel',
      'click': (e) => {
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    // Add Bans to the List
    this.channel.once('banList', (bans) => {
      bans.forEach(ban => {
        let li = $('<li />', {
          'text': ban.banMask,
          'click': (e) => {
            if (!isChannelOperator) {
              return
            }
            $('.selected').each(e => e.removeClass('selected'))
            li.addClass('selected')
            unbanButton.prop('disabled', false)
          }
        }).data('banMask', ban.banMask).appendTo(banList)
      })
    })

    // Close the Window on Esc
    let handler = null
    handler = (e) => {
      if ((e.which || e.keyCode) === 27) {
        window.removeEventListener('keyup', handler)
        inlineWindow.remove()
      }
    }
    window.addEventListener('keyup', handler)

    // Configure the inputs based on the actual Channel Modes
    this.channel.once('modes', (source, newModes, newModeParameters) => {
      topic.prop('disabled', this.channel.modes.includes('t') && !isChannelOperator)

      $('#m-private').prop('disabled', !isChannelOperator)
      $('#m-private').prop('checked', this.channel.modes.includes('p'))

      $('#m-moderated').prop('disabled', !isChannelOperator)
      $('#m-moderated').prop('checked', this.channel.modes.includes('m'))

      $('#m-secret').prop('disabled', !isChannelOperator)
      $('#m-secret').prop('checked', this.channel.modes.includes('s'))

      $('#m-inviteonly').prop('disabled', !isChannelOperator)
      $('#m-inviteonly').prop('checked', this.channel.modes.includes('i'))

      $('#m-no-extmsg').prop('disabled', !isChannelOperator)
      $('#m-no-extmsg').prop('checked', this.channel.modes.includes('n'))

      $('#m-opstopic').prop('disabled', !isChannelOperator)
      $('#m-opstopic').prop('checked', this.channel.modes.includes('t'))

      if (this.channel.modes.includes('l')) {
        this.channel.userLimit = newModeParameters[1]
        $('#m-max-users').val(newModeParameters[1])
      }
      $('#m-max-users').prop('disabled', !isChannelOperator)

      if (this.channel.modes.includes('k')) {
        console.log(newModeParameters)
        if (this.channel.modes.includes('l')) {
          $('#m-key').val(newModeParameters[2])
          this.channel.channelKey = newModeParameters[2]
        } else {
          $('#m-key').val(newModeParameters[1])
          this.channel.channelKey = newModeParameters[1]
        }
      }

      $('#m-key').prop('disabled', !isChannelOperator)

      if (!isChannelOperator) {
        banList.css('backgroundColor', '#EBEBE4')
      }
    })

    topic.focus()

    // Request the Channel Modes from the Server
    this.channel.getModes()
    this.channel.getModes('b')
  }

  saveChannelModes (newTopic) {
    let mode = (m, v) => {
      if (this.channel.modes.includes(m) && !v) {
        return `-${m}`
      } else if (!this.channel.modes.includes(m) && v) {
        return `+${m}`
      }
      return ''
    }

    if (newTopic !== (this.channel.topic || '')) {
      this.channel.setTopic(newTopic)
    }

    let channelUser = this.channel.getChannelUser(this.client.localUser)
    let isChannelOperator = channelUser.modes.includes('o')

    if (!isChannelOperator) {
      return
    }

    let isPrivate = $('#m-private').is(':checked')
    let isModerated = $('#m-moderated').is(':checked')
    let isSecret = $('#m-secret').is(':checked')
    let isInviteOnly = $('#m-inviteonly').is(':checked')
    let noExternalMessages = $('#m-no-extmsg').is(':checked')
    let onlyOpsSetTopic = $('#m-opstopic').is(':checked')

    let newModes = ''
    newModes += mode('p', isPrivate)
    newModes += mode('m', isModerated)
    newModes += mode('s', isSecret)
    newModes += mode('i', isInviteOnly)
    newModes += mode('n', noExternalMessages)
    newModes += mode('t', onlyOpsSetTopic)

    if (newModes) {
      this.channel.setModes(newModes)
    }

    let userLimit = parseInt($('#m-max-users').val())
    if (userLimit && userLimit !== 0 && userLimit !== this.channel.userLimit) {
      this.channel.setModes('+l', [userLimit])
    } else if (this.channel.userLimit && userLimit !== this.channel.userLimit) {
      this.channel.setModes('-l')
    } else if (userLimit === 0) {
      this.channel.setModes('-l')
    }

    delete this.channel.userLimit

    let channelKey = $('#m-key').val()
    if (channelKey && channelKey !== this.channel.channelKey) {
      this.channel.setModes('+k', [channelKey])
    } else if (this.channel.channelKey && channelKey !== this.channel.channelKey) {
      this.channel.setModes('-k', [this.channel.channelKey])
    }

    delete this.channel.channelKey
  }

  createChannelView () {
    const channelTitleMenu = Menu.buildFromTemplate([{
      label: 'Set Topic',
      click: () => {
        this.displayChannelModes()
      }
    }])

    const channelMessageViewMenu = Menu.buildFromTemplate([{
      label: 'Channel Modes',
      click: () => {
        this.displayChannelModes()
      }
    }])

    let rightColumn = $('#right-column')

    this.channelView = $('<table />', {
      'style': 'display: none',
      'cellSpacing': 0,
      'cellPadding': 0,
      'class': 'channel-view'
    }).appendTo(rightColumn)

    let row = $('<tr />').appendTo(this.channelView)
    let messagesCell = $('<td />', { class: 'messages-panel' }).appendTo(row)
    this.usersView = $('<td />', { 'class': 'users-panel' }).appendTo(row)

    let contentView = $('<div />', { 'class': 'channel-content-view' }).appendTo(messagesCell)

    this.titleView = $('<div />', {
      'class': 'channel-title-label',
      'contextmenu': (e) => {
        e.preventDefault()
        channelTitleMenu.popup({ window: remote.getCurrentWindow() })
      }
    })

    $('<div />', { 'class': 'channel-title-view' }).append(this.titleView).appendTo(contentView)

    this.messageView = $('<div />', {
      'class': 'channel-message-view',
      'contextmenu': (e) => {
        e.preventDefault()
        channelMessageViewMenu.popup({ window: remote.getCurrentWindow() })
      }
    }).appendTo(contentView)

    this.channelToolbar = $('<div />', {
      class: 'toolbar toolbar-footer',
      style: 'height: 40px; display: none'
    }).appendTo(rightColumn)

    let input = $('<input />', {
      'type': 'text',
      'class': 'chat-input',
      'placeholder': 'Send Message …',
      'autofocus': true
    }).appendTo(this.channelToolbar)

    input.keyup((e) => {
      if (e.keyCode === 13) {
        this.sendUserInput(input.val())
        input.val('')
      }
    })

    inputhistory(input)
  }

  sendUserInput (text) {
    if (!text) {
      return
    }

    if (text[0] === '/') {
      this.sendAction(text)
      this.scrollToBottom()
    } else {
      text.match(/.{1,398}/g).forEach(chunk => {
        this.channel.sendMessage(chunk)
      })
      this.scrollToBottom()
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
      case 'part':
        this.channel.part()
        break
      case 'me':
        this.ctcpClient.action([this.channel.name], content)
        this.channels[this.channel.name].displayAction(this.client.localUser, content)
        break
      case 'nick':
        this.client.setNickName(content)
        break
      case 'topic':
        this.channel.setTopic(content)
        break
      case 'hop':
        {
          let newChannel = content.substr(content.indexOf(' ') + 1).trim()
          let name = this.channel.name
          this.channel.part()
          if (newChannel.length !== 0) {
            this.client.joinChannel(newChannel)
          } else {
            this.client.joinChannel(name)
          }
        }
        break
      default:
        this.displayMessage(null, '* Unknown Command')
        break
    }
  }

  displayKickPrompt (channelUser, shouldBan = false) {
    // "Window"
    let inlineWindow = $('<div />', { 'id': 'kick-prompt', 'class': 'prompt-window' }).appendTo('body')

    // Title
    $('<div />', {
      'class': 'prompt-title',
      'text': `Kick ${shouldBan ? '& Ban ' : ''}${channelUser.user.name}`
    }).append(
      $('<span />', {
        'class': 'close',
        'click': () => inlineWindow.remove()
      })
    ).appendTo(inlineWindow)

    // Container
    let innerView = $('<div />', { 'style': 'padding: 10px' }).appendTo(inlineWindow)

    // NickName
    $('<div />', { 'text': 'Message' }).appendTo(innerView)

    let message = $('<input />', {
      'type': 'text',
      'style': 'width: 276px; margin-top: 3px; margin-bottom: 10px;',
      'onEnter': (e) => {
        if (shouldBan) {
          channelUser.ban()
        }
        channelUser.kick(message.val().trim())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': 'Kick',
      'type': 'submit',
      'click': (e) => {
        if (shouldBan) {
          channelUser.ban()
        }
        channelUser.kick(message.val().trim())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': 'Cancel',
      'click': (e) => {
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    // Close the Window on Esc
    let handler = null
    handler = (e) => {
      if ((e.which || e.keyCode) === 27) {
        window.removeEventListener('keyup', handler)
        inlineWindow.remove()
      }
    }
    window.addEventListener('keyup', handler)
  }
}

module.exports = IrcChannelViewController

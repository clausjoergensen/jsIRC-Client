// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu } = remote

const events = require('events')
const { EventEmitter } = events

const { IrcUser } = require('jsirc')
const IrcMessageFormatter = require('./IrcMessageFormatter.js')

const Autolinker = require('autolinker')
const inputhistory = require('./inputhistory.js')

const __ = require('./i18n.js')
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

    this.channel.on('modes', (source, newModes, newModeParameters) => {
      if (source instanceof IrcUser) {
        this.displayAction(source, __('USER_SET_CHANNEL_MODE',
          newModes.join(''), newModeParameters ? newModeParameters.join('') : ''))
      }
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
    let paragraph = IrcMessageFormatter.formatMessage(this.client.localUser, errorMessage, { isError: true })
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  displayAction (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(source, text, { isAction: true })
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  displayNotice (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(source, text, { isNotice: true })
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  displayMessage (source, text, isNotice = false) {
    let paragraph = IrcMessageFormatter.formatMessage(source, text)
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  displayTopic (source = null, newTopic = null) {
    if (!newTopic) {
      this.titleView.html(__('NO_CHANNEL_TOPIC'))
    } else {
      let html = IrcMessageFormatter.colorifyMessage(newTopic)
      html = Autolinker.link(html, {
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
      this.titleView.html(`<span title="${newTopic}">${html}</span>`)
    }

    if (source) {
      this.displayAction(source, __('USER_CHANGED_TOPIC', newTopic))
    }
  }

  displayUsers () {
    this.usersView.empty()

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
          label: __('USER_MENU_INFO'),
          click: () => {
            this.ctcpClient.finger([user.nickName])
          }
        },
        {
          label: __('USER_MENU_WHOIS'),
          click: () => {
            this.client.queryWhoIs([user.nickName])
          }
        },
        { type: 'separator' },
        {
          label: __('USER_MENU_CONTROL'),
          submenu: [
            {
              label: __('USER_MENU_CONTROL_OP'),
              click: () => {
                channelUser.op()
              }
            },
            {
              label: __('USER_MENU_CONTROL_DEOP'),
              click: () => {
                channelUser.deop()
              }
            },
            {
              label: __('USER_MENU_CONTROL_VOICE'),
              click: () => {
                channelUser.voice()
              }
            },
            {
              label: __('USER_MENU_CONTROL_DEVOICE'),
              click: () => {
                channelUser.devoice()
              }
            },
            {
              label: __('USER_MENU_CONTROL_KICK'),
              click: () => {
                channelUser.kick()
              }
            },
            {
              label: __('USER_MENU_CONTROL_KICKWHY'),
              click: () => {
                this.displayKickPrompt(channelUser)
              }
            },
            {
              label: __('USER_MENU_CONTROL_BAN'),
              click: () => {
                channelUser.ban()
              }
            },
            {
              label: __('USER_MENU_CONTROL_KICKBAN'),
              click: () => {
                channelUser.ban()
                channelUser.kick()
              }
            },
            {
              label: __('USER_MENU_CONTROL_KICKBANWHY'),
              click: () => {
                this.displayKickPrompt(channelUser, true)
              }
            }
          ]
        },
        {
          label: __('USER_MENU_CTCP'),
          submenu: [
            {
              label: __('USER_MENU_CTCP_PING'),
              click: () => {
                this.ctcpClient.ping([user.nickName])
              }
            },
            {
              label: __('USER_MENU_CTCP_TIME'),
              click: () => {
                this.ctcpClient.time([user.nickName])
              }
            }, {
              label: __('USER_MENU_CTCP_VERSION'),
              click: () => {
                this.ctcpClient.version([user.nickName])
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: __('USER_MENU_SLAP'),
          click: () => {
            let slapMessage = __('ACTION_SLAP', user.nickName)
            this.ctcpClient.action([this.channel.name], slapMessage)
            this.displayAction(this.client.localUser, slapMessage)
          }
        }
      ])

      let userElement = $('<div />', {
        'class': 'user',
        'dblclick': (e) => {
          if (!user.isLocalUser) {
            this.emit('viewUser', user)
          }
        },
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
    let table1 = $('<table />', {
      'border': 0,
      'cellSpacing': 0,
      'cellPadding': 0,
      'style': 'border-collapse: separate; border-spacing: 0px 5px;'
    })

    let row = $('<tr />').appendTo(table1)

    let chIsPrivate = $('<input />', { 'type': 'checkbox', 'id': 'm-private' })
    $('<td />', { 'valign': 'top' })
      .append(chIsPrivate)
      .append($('<label />', { 'for': 'm-private', 'class': 'input', 'text': __('CHANNEL_MODE_PRIVATE') }))
      .appendTo(row)

    let chInviteOnly = $('<input />', { 'type': 'checkbox', 'id': 'm-inviteonly' })
    $('<td />', { 'valign': 'top', 'style': 'padding-left: 5px' })
      .append(chInviteOnly)
      .append($('<label />', { 'for': 'm-inviteonly', 'class': 'input', 'text': __('CHANNEL_MODE_INVITE_ONLY') }))
      .appendTo(row)

    row = $('<tr />').appendTo(table1)

    let chIsModerated = $('<input />', { 'type': 'checkbox', 'id': 'm-moderated' })
    $('<td />', { 'valign': 'top' })
      .append(chIsModerated)
      .append($('<label />', { 'for': 'm-moderated', 'class': 'input', 'text': __('CHANNEL_MODE_MODERATED') }))
      .appendTo(row)

    let chNoExternalMsg = $('<input />', { 'type': 'checkbox', 'id': 'm-no-extmsg' })
    $('<td />', { 'valign': 'top', 'style': 'padding-left: 5px' })
      .append(chNoExternalMsg)
      .append($('<label />', { 'for': 'm-no-extmsg', 'class': 'input', 'text': __('CHANNEL_MODE_NO_EXT_MSG') }))
      .appendTo(row)

    row = $('<tr />').appendTo(table1)

    let chIsSecret = $('<input />', { 'type': 'checkbox', 'id': 'm-secret' })
    $('<td />', { 'valign': 'top' })
      .append(chIsSecret)
      .append($('<label />', { 'for': 'm-secret', 'class': 'input', 'text': __('CHANNEL_MODE_SECRET') }))
      .appendTo(row)

    let chOnlyOpsSetTopic = $('<input />', { 'type': 'checkbox', 'id': 'm-opstopic' })
    $('<td />', { 'valign': 'top', 'style': 'padding-left: 5px' })
      .append(chOnlyOpsSetTopic)
      .append($('<label />', { 'for': 'm-opstopic', 'class': 'input', 'text': __('CHANNEL_MODE_OPSTOPIC') }))
      .appendTo(row)

    let table2 = $('<table />', {
      'border': 0,
      'cellSpacing': 0,
      'cellPadding': 0,
      'style': 'margin-top: 10px; margin-left: 20px;'
    })

    row = $('<tr />').appendTo(table2)

    let inputKey = $('<input />', { 'type': 'text', 'id': 'm-key', 'style': 'width: 100px' })
    $('<td />', { 'style': 'text-align: right; padding-right: 5px;' })
      .append($('<label />', { 'for': 'm-key', 'text': __('CHANNEL_MODE_KEY') }))
      .appendTo(row)
    $('<td />')
      .append(inputKey)
      .appendTo(row)

    row = $('<tr />').appendTo(table2)

    let inputMaxUsers = $('<input />', { 'type': 'text', 'id': 'm-max-users', 'style': 'width: 100px' })
    $('<td />', { 'style': 'text-align: right; padding-right: 5px;' })
      .append($('<label />', { 'for': 'm-max-users', 'text': __('CHANNEL_MODE_MAX_USERS') }))
      .appendTo(row)
    $('<td />')
      .append(inputMaxUsers)
      .appendTo(row)

    $('<div />', { 'id': 'modes-box' })
      .append($('<div />', { 'text': __('CHANNEL_MODE_LABEL') }))
      .append(table1)
      .append(table2)
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
    $('<div />', { 'text': __('BAN_LIST_LABEL') }).appendTo(innerView)

    let banList = $('<ul />', { 'id': 'ban-list' }).appendTo(innerView)

    // Buttons
    let unbanButton = $('<button />', {
      'text': __('BUTTON_UNBAN'),
      'style': 'float: left; margin-left: 0px;',
      'disabled': 'disabled',
      'class': 'btn btn-negative',
      'click': (e) => {
        if (!isChannelOperator) {
          return
        }
        let selected = $('#ban-list').find('.selected').first()
        let banMask = selected.data('banMask')
        this.channel.unban(banMask)
        unbanButton.prop('disabled', true)
        selected.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': __('BUTTON_OK'),
      'type': 'submit',
      'class': 'btn btn-primary',
      'click': (e) => {
        this.saveChannelModes(topic.val())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': __('BUTTON_CANCEL'),
      'class': 'btn btn-default',
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

      chIsPrivate.prop('disabled', !isChannelOperator)
      chIsPrivate.prop('checked', this.channel.modes.includes('p'))

      chIsModerated.prop('disabled', !isChannelOperator)
      chIsModerated.prop('checked', this.channel.modes.includes('m'))

      chIsSecret.prop('disabled', !isChannelOperator)
      chIsSecret.prop('checked', this.channel.modes.includes('s'))

      chInviteOnly.prop('disabled', !isChannelOperator)
      chInviteOnly.prop('checked', this.channel.modes.includes('i'))

      chNoExternalMsg.prop('disabled', !isChannelOperator)
      chNoExternalMsg.prop('checked', this.channel.modes.includes('n'))

      chOnlyOpsSetTopic.prop('disabled', !isChannelOperator)
      chOnlyOpsSetTopic.prop('checked', this.channel.modes.includes('t'))

      if (this.channel.modes.includes('l')) {
        this.channel.userLimit = newModeParameters[1]
        inputMaxUsers.val(newModeParameters[1])
      }
      inputMaxUsers.prop('disabled', !isChannelOperator)

      if (this.channel.modes.includes('k')) {
        if (this.channel.modes.includes('l')) {
          inputKey.val(newModeParameters[2])
          this.channel.channelKey = newModeParameters[2]
        } else {
          inputKey.val(newModeParameters[1])
          this.channel.channelKey = newModeParameters[1]
        }
      }

      inputKey.prop('disabled', !isChannelOperator)

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
      label: __('CHAT_MENU_CHANNEL_MODES'),
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
      'placeholder': __('PLACEHOLDER_SEND_MESSAGE'),
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
      text.trim().match(/.{1,398}/g).forEach(chunk => {
        this.channel.sendMessage(chunk)
      })
      this.scrollToBottom()
    }
  }

  sendAction (text) {
    let firstSpace = text.substring(1).indexOf(' ')
    let action = text.substring(1, firstSpace + 1)
    let content = text.substring(1).substr(firstSpace + 1).trim()

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
        this.displayMessage(null, __('UNKNOWN_COMMAND'))
        break
    }
  }

  displayKickPrompt (channelUser, shouldBan = false) {
    // "Window"
    let inlineWindow = $('<div />', { 'id': 'kick-prompt', 'class': 'prompt-window' }).appendTo('body')

    // Title
    $('<div />', {
      'class': 'prompt-title',
      'text': __(shouldBan ? 'KICKBAN_TITLE' : 'KICK_TITLE', channelUser.user.name)
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
      'autofocus': true,
      'onEnter': (e) => {
        if (shouldBan) {
          channelUser.ban()
        }
        channelUser.kick(message.val().trim())
        inlineWindow.remove()
      }
    }).appendTo(innerView)

    $('<button />', {
      'text': __('BUTTON_KICK'),
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
      'text': __('BUTTON_CANCEL'),
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

    message.focus()
  }
}

module.exports = IrcChannelViewController

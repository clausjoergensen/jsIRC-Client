// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const events = require('events')
const { EventEmitter } = events

const IrcMessageFormatter = require('./IrcMessageFormatter.js')
const IrcCommandHandler = require('./IrcCommandHandler.js')

const inputhistory = require('./external/inputhistory.js') // eslint-disable-line no-unused-vars
const __ = require('./i18n.js')
const $ = require('jquery')

require('./IrcBroadcaster.js')

$.fn.onEnter = function (func) {
  this.bind('keypress', function (e) {
    if (e.keyCode === 13) {
      func.apply(this, [e])
    }
  })
  return this
}

class IrcUserViewController extends EventEmitter {
  constructor (client, ctcpClient, user) {
    super()

    this.client = client
    this.ctcpClient = ctcpClient
    this.user = user

    this.client.localUser.on('message', (source, targets, messageText) => {
      if (source === this.user) {
        this.displayMessage(source, messageText)
      }
    })

    this.commandHandler = new IrcCommandHandler(this.client, this.ctcpClient)
    this.commandHandler.on('clear', () => {
      this.userView.empty()
    })

    global.broadcaster.on('clearAll', () => {
      this.userView.empty()
    })

    this.createUserView()
  }

  show () {
    this.userView.css('display', 'block')
    this.userToolbar.css('display', 'block')
    this.userToolbar.find('.chat-input')[0].focus()
  }

  hide () {
    this.userView.css('display', 'none')
    this.userToolbar.css('display', 'none')
  }

  remove () {
    this.userView.remove()
    this.userToolbar.remove()
  }

  scrollToBottom () {
    this.messageView.scrollTop(this.messageView.prop('scrollHeight'))
  }

  sendUserInput (text) {
    if (!text) {
      return
    }

    if (IrcCommandHandler.isCommand(text)) {
      this.commandHandler.handle(text.trim(), null, (source, text) => {
        this.displayAction(source, text)
      })
    } else {
      text.trim().match(/.{1,398}/g).forEach(chunk => {
        this.client.localUser.sendMessage([this.user.nickName], chunk)
        this.displayMessage(this.client.localUser, chunk)
      })
    }

    this.scrollToBottom()
  }

  displayMessage (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(source, text, { isPrivate: true })
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  displayAction (source, text) {
    let paragraph = IrcMessageFormatter.formatMessage(source, text, { isPrivate: true, isAction: true })
    this.messageView.append(paragraph)
    this.scrollToBottom()
  }

  createUserView () {
    let rightColumn = $('#right-column')

    this.userView = $('<div />', {
      'class': 'user-view',
      'style': 'display: none'
    }).appendTo(rightColumn)

    let contentView = $('<div />', {
      'class': 'user-content-view'
    }).appendTo(this.userView)

    this.titleView = $('<div />', {
      'class': 'user-title-label',
      'text': this.user.nickName
    })

    $('<div />', { 'class': 'user-title-view' }).append(this.titleView).appendTo(contentView)

    this.messageView = $('<div />', {
      'class': 'user-message-view'
    }).appendTo(contentView)

    this.userToolbar = $('<div />', {
      class: 'toolbar toolbar-footer',
      style: 'height: 40px; display: none'
    }).appendTo(rightColumn)

    let input = $('<input />', {
      'type': 'text',
      'class': 'chat-input',
      'placeholder': __('PLACEHOLDER_SEND_MESSAGE'),
      'autofocus': true
    }).appendTo(this.userToolbar)

    input.keyup((e) => {
      if (e.keyCode === 13) {
        this.sendUserInput(input.val())
        input.val('')
      }
    })

    input.inputhistory()
  }
}

module.exports = IrcUserViewController

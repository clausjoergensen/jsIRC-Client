// Copyright (c) 2018 Claus Jørgensen
'use strict'

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

    if (text[0] === '/') {
      this.sendAction(text)
      this.scrollToBottom()
    } else {
      text.match(/.{1,398}/g).forEach(chunk => {
        this.client.localUser.sendMessage([this.user.nickName], chunk)
        this.displayMessage(this.client.localUser, chunk)
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
      case 'me':
        this.ctcpClient.action([this.user.name], content)
        this.displayAction(this.client.localUser, content)
        break
    }
  }

  displayMessage (source, text) {
    let senderName = `&lt;${source.nickName}&gt;`
    let senderClass = source.isLocalUser ? 'sender-me' : 'sender-other'
    let messageClass = source.isLocalUser ? 'message-by-me' : 'message-by-other'

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

    let paragraph = $('<p />', { 'class': 'user-message' }).appendTo(this.messageView)
    paragraph.html(formattedText)

    this.scrollToBottom()
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
      'placeholder': 'Send Message …',
      'autofocus': true
    }).appendTo(this.userToolbar)

    input.keyup((e) => {
      if (e.keyCode === 13) {
        this.sendUserInput(input.val())
        input.val('')
      }
    })

    inputhistory(input)
  }
}

module.exports = IrcUserViewController

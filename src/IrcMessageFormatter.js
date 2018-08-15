// Copyright (c) 2018 Claus Jørgensen
'use strict'

const strftime = require('strftime')
const Autolinker = require('autolinker')
const $ = require('jquery')

class IrcMessageFormatter {
  static seperator () {
    return $('<p />', { 'class': 'server-message seperator', 'text': '-' })
  }

  static formatMessage (source, message, options = {}) {
    options = $.extend({
      isNotice: false,
      isAction: false,
      isPrivate: false,
      isServer: false,
      isError: false,
      detectLinks: true,
      stripColors: true,
      class: ''
    }, options)

    let senderName = ''
    if (source) {
      if (source.nickName) {
        if (options.isNotice) {
          senderName = `-${source.nickName}-`
        } else if (options.isAction) {
          senderName = `* ${source.nickName} `
        } else {
          senderName = `&lt;${source.nickName}&gt;`
        }
      } else if (source.hostName) {
        senderName = `-${source.hostName}-`
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

    let token = 'message'
    if (options.isNotice) {
      token = 'notice'
    } else if (options.isAction) {
      token = 'action'
    }

    let messageClass = ''
    if (source) {
      if (source.nickName) {
        messageClass = source.isLocalUser ? `${token}-by-me` : `${token}-by-other`
      } else if (source.hostName) {
        senderClass = `${token}-by-server`
      }
    }

    if (options.class) {
      messageClass += ' ' + options.class
    }

    if (options.stripColors) {
      // eslint-disable-next-line no-control-regex
      message = message.replace(/[\x00-\x1F]/g, '')
    }

    if (options.detectLinks) {
      message = Autolinker.link(message, {
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
    }

    let formattedText =
      `<span class="timestamp">[${strftime('%H:%M', new Date())}]</span> ` +
      `<span class="${senderClass}">${senderName}</span> ` +
      `<span class="${messageClass}">${message}</span>`

    let paragraph = $('<p />')
    
    if (options.isPrivate) {
      paragraph.addClass('user-message')
    } else if (options.isServer) {
      paragraph.addClass('server-message')
    } else {
      paragraph.addClass('channel-message')
    }

    if (options.isError) {
      paragraph.addClass('error-message')
    } 

    paragraph.html(formattedText)

    return paragraph
  }
}

module.exports = IrcMessageFormatter

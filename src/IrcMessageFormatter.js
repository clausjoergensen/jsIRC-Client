// Copyright (c) 2018 Claus Jørgensen
'use strict'

const strftime = require('strftime')
const Autolinker = require('autolinker')
const htmlencode = require('htmlencode')
const $ = require('jquery')

class IrcMessageFormatter {
  static seperator () {
    return $('<p />', { 'class': 'server-message seperator', 'text': '-' })
  }

  static colorifyMessage (message) {
    let isBold = false
    let isColor = false
    let isItalic = false
    let isUnderline = false

    let output = ''

    for (let i = 0; i < message.length; i++) {
      switch (message[i]) {
        case '':
          if (isBold) {
            isBold = false
            output += '</span>'
          } else {
            isBold = true
            output += '<span style="font-weight: bold">'
          }
          break
        case '':
          if (isColor) {
            output += '</span>'
          }
          isColor = true
          let color = ''
          switch (parseInt(message[i + 1])) {
            case 1: color = 'white'; break
            case 2: color = 'black'; break
            case 3: color = 'green'; break
            case 4: color = 'red'; break
            case 5: color = 'brown'; break
            case 6: color = 'purple'; break
            case 7: color = 'orange'; break
            case 8: color = 'yellow'; break
            case 9: color = 'lime'; break
            case 10: color = 'teal'; break
            case 11: color = 'cyan'; break
            case 12: color = 'royal'; break
            case 13: color = 'pink'; break
            case 14: color = 'grey'; break
            case 15: color = 'silver'; break
          }
          output += `<span style="color: ${color}">`
          i++
          break
        case '':
          if (isItalic) {
            isItalic = false
            output += '</span>'
          } else {
            isItalic = true
            output += '<span style="font-style: italic">'
          }
          break
        case '':
          if (isUnderline) {
            isUnderline = false
            output += '</span>'
          } else {
            isUnderline = true
            output += '<span style="text-decoration: underline">'
          }
          break
        case '':
          // Unsupported
          break
        case '':
          if (isBold) {
            output += '</span>'
          }
          if (isItalic) {
            output += '</span>'
          }
          if (isUnderline) {
            output += '</span>'
          }
          if (isColor) {
            output += '</span>'
          }
          break
        default:
          output += message[i]
          break
      }
    }

    if (isColor) {
      output += '</span>'
    }

    return output
  }

  static formatMessage (source, message, options = {}) {
    options = $.extend({
      isNotice: false,
      isAction: false,
      isPrivate: false,
      isServer: false,
      isError: false,
      detectLinks: true,
      stripColors: false,
      highlight: false,
      timestamp: true,
      preformatted: false,
      class: ''
    }, options)

    let senderName = null
    if (source) {
      if (source.nickName) {
        if (options.isNotice) {
          senderName = `-${source.nickName}-`
        } else if (options.isAction) {
          senderName = `* ${source.nickName} `
        } else if (options.isError) {
          senderName = `* ${source.nickName}: `
        } else {
          senderName = `&lt;${source.nickName}&gt;`
        }
      } else if (source.hostName) {
        senderName = `-${source.hostName}-`
      }
    }

    let senderClass = null
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
        messageClass = `${token}-by-server`
      }
    }

    if (options.class) {
      messageClass += ' ' + options.class
    }

    if (options.stripColors) {
      // eslint-disable-next-line no-control-regex
      message = message.replace(/[\x00-\x1F]/g, '')
    }

    if (!options.html) {
      message = htmlencode.htmlEncode(message)
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

    if (!options.stripColors) {
      message = IrcMessageFormatter.colorifyMessage(message)
    }

    let timestampClass = 'timestamp'

    if (options.isError) {
      senderClass += ' error'
      messageClass += ' error'
      timestampClass += ' error'
    }

    if (options.highlight) {
      senderClass += ' highlight'
      messageClass += ' highlight'
      timestampClass += ' highlight'
    }

    if (options.preformatted) {
      messageClass += 'preformatted'
    }

    let formattedText = ''
    if (options.timestamp) {
      formattedText += `<span class="${timestampClass}">[${strftime('%H:%M', new Date())}]</span> `
    }
    if (senderName) {
      formattedText += `<span class="${senderClass}">${senderName}</span> `
    }

    formattedText += `<span class="${messageClass}">${message}</span>`

    let paragraph = $('<p />')

    if (options.isPrivate) {
      paragraph.addClass('user-message')
    } else if (options.isServer) {
      paragraph.addClass('server-message')
    } else {
      paragraph.addClass('channel-message')
    }

    if (options.isError) {
      paragraph.addClass('error')
    }

    paragraph.html(formattedText)

    return paragraph
  }
}

module.exports = IrcMessageFormatter

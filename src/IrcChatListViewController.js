// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { Menu, app, shell } = remote

const events = require('events')
const { EventEmitter } = events

const IrcChatViewController = require('./IrcChatViewController.js')
const $ = require('jquery')

class IrcChatListViewController extends EventEmitter {
  constructor () {
    super()

    this.connections = {}

    this.chatInput = document.getElementById('chat-input')
    this.chatInput.addEventListener('keyup', e => {
      e.preventDefault()
      if (e.keyCode === 13) {
        this.sendUserInput(this.chatInput.value)
        this.chatInput.value = ''
      }
    })

    $(document).on('click', 'a[href^="http"]', function (event) {
      event.preventDefault()
      shell.openExternal(this.href)
    })

    window.onfocus = () => {
      this.focusInputField()
    }
  }

  addServer(client) {
    let chatViewController = new IrcChatViewController(client)
    this.connections[client.id] = chatViewController
  }

  viewServer (client, serverName) {
    Object.keys(this.connections).forEach((key, index) => {
      this.connections[key].hide()
    })
    
    this.connections[client.id].viewServer(serverName)
    this.selectedConnection = this.connections[client.id]
  }

  viewChannel (client, channel) {
    Object.keys(this.connections).forEach((key, index) => {
      this.connections[key].hide()
    })
    
    this.connections[client.id].viewChannel(channel)    
    this.selectedConnection = this.connections[client.id]    
  }

  sendAction (text) {
    /*let firstSpace = text.substring(1).indexOf(' ')
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
        this.selectedChannel.part()
        break
      case 'me':
        if (this.selectedChannel) {
          this.ctcpClient.action([this.selectedChannel.name], content)
          this.displayChannelAction(this.selectedChannel.name, this.client.localUser, content)
        } else {
          this.displayServerMessage(null, '* Cannot use /me in this view.')
        }
        break
      case 'nick':
        this.client.setNickName(content)
        break
      case 'topic':
        if (this.selectedChannel) {
          this.client.setTopic(this.selectedChannel.name, content)
        }
        break
      case 'hop':
        {
          let newChannel = content.substr(content.indexOf(' ') + 1).trim()
          if (this.selectedChannel) {
            var name = this.selectedChannel.name
            this.selectedChannel.part()
            if (newChannel.length !== 0) {
              this.client.joinChannel(newChannel)
            } else {
              this.client.joinChannel(name)
            }
          } else {
            this.displayServerMessage(null, '* Cannot use /hop in this view.')
          }
        }
        break
    }*/
  }

  sendUserInput (text) {
    if (text[0] === '/') {
      //this.sendAction(text)
    } else {
      if (this.selectedConnection.selectedChannel) {
        var chunks = text.match(/.{1,398}/g)
        chunks.forEach(chunk => {
          this.selectedConnection.sendMessage(chunk)
        })
      } else {
        //this.selectedConnection.serverViewController.displayServerMessage(null, '* You are not on a channel')
      }
    }
  }

  focusInputField () {
    this.chatInput.focus()
  }

  //this.client.on('protocolError', this.protocolError.bind(this))
  /*protocolError (command, errorName, errorParameters, errorMessage) {
      switch (command) {
        case 433: // ERR_NICKNAMEINUSE
          //this.displayServerError(`Nickname '${errorParameters[0]}' is already in use.`)
          //this.chatInput.value = '/nick '
          //this.focusInputField()
          break
        case 482: // ERR_CHANOPRIVSNEEDED
          //this.displayChannelError(errorParameters[0], errorMessage)
          break
        default:
          console.error(`Unsupported protocol error ${errorName}(${command}).`, errorParameters, errorMessage)
          break
      }
    }
  }*/
}

module.exports = IrcChatListViewController

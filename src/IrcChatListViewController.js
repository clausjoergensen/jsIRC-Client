// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote } = require('electron')
const { shell } = remote

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

  addServer (client) {
    let chatViewController = new IrcChatViewController(client)
    chatViewController.on('nickNameAlreadyInUse', () => {
      this.chatInput.value = '/nick '
      this.focusInputField()
    })
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

  sendUserInput (text) {
    this.selectedConnection.sendUserInput(text)
  }

  focusInputField () {
    this.chatInput.focus()
  }
}

module.exports = IrcChatListViewController

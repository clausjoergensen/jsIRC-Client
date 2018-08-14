// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { IrcClient, IrcFloodPreventer, CtcpClient } = require('jsIRC')

const IrcNetworkListController = require('./IrcNetworkListController.js')
const IrcChatController = require('./IrcChatController.js')

class IrcViewController {
  constructor () {
    this.networkListController = new IrcNetworkListController()
  }

  connectToServer (server, port, registrationInfo, channels) {
    let client = new IrcClient()
    client.floodPreventer = new IrcFloodPreventer(4, 2000)
    
    this.chatController = new IrcChatController(client)

    this.networkListController.addServer(client)    
    this.networkListController.on('viewChannel', (client, channel) => {
        this.chatController.viewChannel(channel)
    })
    this.networkListController.on('viewServer', (client, serverName) => {
        this.chatController.viewServer()
    })

    client.on('registered', () => {
      channels.forEach(channel => client.joinChannel(channel))
    })

    client.connect(server, port, registrationInfo)
  }
}

module.exports = IrcViewController

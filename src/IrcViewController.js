// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { IrcClient, IrcFloodPreventer } = require('jsIRC')

const IrcNetworkListViewController = require('./IrcNetworkListViewController.js')
const IrcChatListViewController = require('./IrcChatListViewController.js')

class IrcViewController {
  constructor () {
    this.networkListViewController = new IrcNetworkListViewController()
    this.chatListViewController = new IrcChatListViewController()
  }

  connectToServer (server, port, registrationInfo) {
    let client = new IrcClient()
    client.floodPreventer = new IrcFloodPreventer(4, 2000)

    this.chatListViewController.addServer(client)

    this.networkListViewController.addServer(client)
    this.networkListViewController.on('viewChannel', (client, channel) => {
      this.chatListViewController.viewChannel(client, channel)
    })
    this.networkListViewController.on('viewServer', (client, serverName) => {
      this.chatListViewController.viewServer(client, serverName)
    })

    client.on('registered', () => {
      client.joinChannel('#UnseenUniversity', 'luggage')
    })

    client.connect(server, port, registrationInfo)
  }
}

module.exports = IrcViewController

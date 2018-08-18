// Copyright (c) 2018 Claus Jørgensen
'use strict'

const events = require('events')
const { EventEmitter } = events

const { CtcpClient } = require('jsirc')

const IrcServerViewController = require('./IrcServerViewController.js')
const IrcChannelViewController = require('./IrcChannelViewController.js')
const IrcUserViewController = require('./IrcUserViewController.js')

const packageInfo = require('./../package.json')
const __ = require('./i18n.js')

require('./IrcBroadcaster.js')

class IrcChatViewController extends EventEmitter {
  constructor (client) {
    super()

    this.client = client

    this.ctcpClient = new CtcpClient(client)
    this.ctcpClient.clientName = 'jsIRC'
    this.ctcpClient.clientVersion = packageInfo.version

    this.serverViewController = new IrcServerViewController(this.client, this.ctcpClient)

    this.channels = {}
    this.selectedChannel = null

    this.users = {}
    this.selectedUser = null

    this.client.on('connected', () => {
      this.client.localUser.on('joinedChannel', (channel) => {
        let channelViewController = new IrcChannelViewController(this.client, this.ctcpClient, channel)

        channelViewController.on('viewUser', (user, message) => {
          let userViewController = this.users[user.nickName.toLowerCase()]
          if (!userViewController) {
            userViewController = new IrcUserViewController(this.client, this.ctcpClient, user)
            this.users[user.nickName.toLowerCase()] = userViewController
          }

          this.viewUser(user)

          if (message) {
            userViewController.displayMessage(this.client.localUser, message)
          }

          this.emit('viewUser', this.client, user)
        })

        this.channels[channel.name.toLowerCase()] = channelViewController
      })

      this.client.localUser.on('partedChannel', (channel) => {
        this.channels[channel.name.toLowerCase()].remove()
        delete this.channels[channel.name.toLowerCase()]
      })

      this.client.localUser.on('notice', (source, targets, noticeText) => {
        Object.keys(this.channels).forEach((key, index) => {
          this.channels[key].displayNotice(source, noticeText)
        })
      })

      this.client.localUser.on('message', (source, targets, messageText) => {
        if (this.users[source.nickName.toLowerCase()]) {
          return
        }
        let userViewController = new IrcUserViewController(this.client, this.ctcpClient, source)
        this.users[source.nickName.toLowerCase()] = userViewController
        this.users[source.nickName.toLowerCase()].displayMessage(source, messageText)
      })
    })

    this.client.on('protocolError', this.protocolError.bind(this))
  }

  hide () {
    this.hideServer()
    this.hideAllChannels()
    this.hideAllUsers()
  }

  remove () {
    this.serverViewController.remove()
    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].remove()
    })
    Object.keys(this.users).forEach((key, index) => {
      this.users[key].remove()
    })
  }

  viewServer () {
    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }

    this.selectedChannel = null
    this.serverViewController.show()
  }

  viewChannel (channel) {
    this.hideServer()

    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }

    if (this.selectedUser) {
      this.selectedUser.hide()
    }

    if (this.channels[channel.name.toLowerCase()]) {
      this.selectedChannel = this.channels[channel.name.toLowerCase()]
      this.selectedChannel.show()
    }
  }

  viewUser (user) {
    this.hideServer()

    if (this.selectedChannel) {
      this.selectedChannel.hide()
    }

    if (this.users[user.nickName.toLowerCase()]) {
      this.selectedUser = this.users[user.nickName.toLowerCase()]
      this.selectedUser.show()
    }
  }

  hideUser (user) {
    this.users[user.nickName.toLowerCase()].remove()
    delete this.users[user.nickName.toLowerCase()]
  }

  hideServer () {
    this.serverViewController.hide()
  }

  hideAllChannels () {
    Object.keys(this.channels).forEach((key, index) => {
      this.channels[key].hide()
    })

    this.selectedChannel = null
  }

  hideAllUsers () {
    Object.keys(this.users).forEach((key, index) => {
      this.users[key].hide()
    })

    this.selectedUser = null
  }

  protocolError (command, errorName, errorParameters, errorMessage) {
    switch (command) {
      case 401:
        this.serverViewController.displayError(__('ERR_NOSUCHNICK'))
        break
      case 402:
        this.serverViewController.displayError(__('ERR_NOSUCHSERVER'))
        break
      case 403:
        this.serverViewController.displayError(__('ERR_NOSUCHCHANNEL'))
        break
      case 404:
        this.serverViewController.displayError(__('ERR_CANNOTSENDTOCHAN'))
        break
      case 405:
        this.serverViewController.displayError(__('ERR_TOOMANYCHANNELS'))
        break
      case 406:
        this.serverViewController.displayError(__('ERR_WASNOSUCHNICK'))
        break
      case 407:
        this.serverViewController.displayError(__('ERR_TOOMANYTARGETS', parseInt(errorParameters[1]), errorParameters[2]))
        break
      case 408:
        this.serverViewController.displayError(__('ERR_NOSUCHSERVICE'))
        break
      case 409:
        this.serverViewController.displayError(__('ERR_NOORIGIN'))
        break
      case 411:
        this.serverViewController.displayError(__('ERR_NORECIPIENT', errorParameters[1]))
        break
      case 412:
        this.serverViewController.displayError(__('ERR_NOTEXTTOSEND'))
        break
      case 413:
        this.serverViewController.displayError(__('ERR_NOTOPLEVEL'))
        break
      case 414:
        this.serverViewController.displayError(__('ERR_WILDTOPLEVEL'))
        break
      case 415:
        this.serverViewController.displayError(__('ERR_BADMASK'))
        break
      case 421:
        this.serverViewController.displayError(__('ERR_UNKNOWNCOMMAND'))
        break
      case 422:
        this.serverViewController.displayError(__('ERR_NOMOTD'))
        break
      case 423:
        this.serverViewController.displayError(__('ERR_NOADMININFO'))
        break
      case 424:
        this.serverViewController.displayError(__('ERR_FILEERROR', errorParameters[0], errorParameters[1]))
        break
      case 431:
        this.serverViewController.displayError(__('ERR_NONICKNAMEGIVEN'))
        break
      case 432:
        this.serverViewController.displayError(__('ERR_ERRONEUSNICKNAME'))
        break
      case 433:
        this.serverViewController.displayError(__('ERR_NICKNAMEINUSE', errorParameters[0]))
        break
      case 436:
        this.serverViewController.displayError(__('ERR_NICKCOLLISION', errorParameters[1], errorParameters[2]))
        break
      case 437:
        this.serverViewController.displayError(__('ERR_UNAVAILRESOURCE'))
        break
      case 441:
        this.serverViewController.displayError(__('ERR_USERNOTINCHANNEL'))
        break
      case 442:
        this.serverViewController.displayError(__('ERR_NOTONCHANNEL'))
        break
      case 443:
        this.serverViewController.displayError(__('ERR_USERONCHANNEL', errorParameters[0], errorParameters[1]))
        break
      case 444:
        this.serverViewController.displayError(__('ERR_NOLOGIN'))
        break
      case 445:
        this.serverViewController.displayError(__('ERR_SUMMONDISABLED'))
        break
      case 446:
        this.serverViewController.displayError(__('ERR_USERSDISABLED'))
        break
      case 451:
        this.serverViewController.displayError(__('ERR_NOTREGISTERED'))
        break
      case 461:
        this.serverViewController.displayError(__('ERR_NEEDMOREPARAMS'))
        break
      case 462:
        this.serverViewController.displayError(__('ERR_ALREADYREGISTRED'))
        break
      case 463:
        this.serverViewController.displayError(__('ERR_NOPERMFORHOST'))
        break
      case 464:
        this.serverViewController.displayError(__('ERR_PASSWDMISMATCH'))
        break
      case 465:
        this.serverViewController.displayError(__('ERR_YOUREBANNEDCREEP'))
        break
      case 467:
        this.serverViewController.displayError(__('ERR_KEYSET'))
        break
      case 471:
        this.serverViewController.displayError(__('ERR_CHANNELISFULL', errorParameters[0]))
        break
      case 472:
        this.serverViewController.displayError(__('ERR_UNKNOWNMODE', errorParameters[0], errorParameters[1]))
        break
      case 473:
        this.serverViewController.displayError(__('ERR_INVITEONLYCHAN', errorParameters[0]))
        break
      case 474:
        this.serverViewController.displayError(__('ERR_BANNEDFROMCHAN', errorParameters[0]))
        break
      case 475:
        this.serverViewController.displayError(__('ERR_BADCHANNELKEY', errorParameters[0]))
        break
      case 476:
        this.serverViewController.displayError(__('ERR_BADCHANMASK'))
        break
      case 477:
        this.serverViewController.displayError(__('ERR_NOCHANMODES'))
        break
      case 478:
        this.serverViewController.displayError(__('ERR_BANLISTFULL'))
        break
      case 481:
        this.serverViewController.displayError(__('ERR_NOPRIVILEGES'))
        break
      case 482:
        this.serverViewController.displayError(__('ERR_CHANOPRIVSNEEDED'))
        break
      case 483:
        this.serverViewController.displayError(__('ERR_CANTKILLSERVER'))
        break
      case 484:
        this.serverViewController.displayError(__('ERR_RESTRICTED'))
        break
      case 485:
        this.serverViewController.displayError(__('ERR_UNIQOPPRIVSNEEDED'))
        break
      case 491:
        this.serverViewController.displayError(__('ERR_NOOPERHOST'))
        break
      case 501:
        this.serverViewController.displayError(__('ERR_UMODEUNKNOWNFLAG'))
        break
      case 502:
        this.serverViewController.displayError(__('ERR_USERSDONTMATCH'))
        break
      default:
        console.log(command)
        console.warn(`Unsupported protocol error ${errorName}(${command}).`, errorParameters, errorMessage)
        break
    }
  }
}

module.exports = IrcChatViewController

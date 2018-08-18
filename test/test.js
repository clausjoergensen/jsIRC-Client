// Copyright (c) 2018 Claus Jørgensen
'use strict'

const IrcCommandHandler = require('./../src/IrcCommandHandler.js')
const assert = require('assert')

console.debug = (m) => {}

describe('IrcCommandHandler Tests', function () {
  let fakeIrcClient = {}
  let fakeCtcpClient = {}

  beforeEach(function () {
    fakeIrcClient = {}
    fakeCtcpClient = {}
  })

  it('.isCommand', function () {
    assert.equal(IrcCommandHandler.isCommand('/cmd'), true)
    assert.equal(IrcCommandHandler.isCommand('A Message'), false)
  })

  it('/msg <user> <message>', function (done) {
    fakeIrcClient.localUser = { nickName: 'Twoflower' }
    fakeIrcClient.sendMessage = (targets, message) => {
      if (targets[0] === 'Rincewind' && message === 'Would you like some cheese?') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/msg')
    commandHandler.handle('/msg ')
    commandHandler.handle('/msg Twoflower messaging myself')
    commandHandler.handle('/msg Rincewind')
    commandHandler.handle('/msg Rincewind Would you like some cheese?')
  })

  it('/notice <user> <message>', function (done) {
    fakeIrcClient.localUser = { nickName: 'Twoflower' }
    fakeIrcClient.sendNotice = (targets, notice) => {
      if (targets[0] === 'Rincewind' && notice === 'Would you like some cheese?') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/notice')
    commandHandler.handle('/notice ')
    commandHandler.handle('/notice Twoflower noticing myself')
    commandHandler.handle('/notice Rincewind')
    commandHandler.handle('/notice Rincewind Would you like some cheese?')
  })

  it('/kick <user>', function (done) {
    let fakeChannel = {}
    fakeChannel.kick = (target, reason) => {
      if (target === 'Twoflower' && reason === null) {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/kick')
    commandHandler.handle('/kick ')
    commandHandler.handle('/kick Twoflower')
  })

  it('/kick <user> <reason>)', function (done) {
    let fakeChannel = {}
    fakeChannel.kick = (target, reason) => {
      if (target === 'Twoflower' && reason === 'bloody tourist') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/kick Twoflower bloody tourist')
  })

  it('/ban <hostMask>', function (done) {
    let fakeChannel = {}
    fakeChannel.ban = (hostMask) => {
      if (hostMask === '*!*@localhost') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/ban')
    commandHandler.handle('/ban ')
    commandHandler.handle('/ban *!*@localhost')
  })

  it('/away', function (done) {
    fakeIrcClient.localUser = {
      'isAway': false,
      'setAway': (message) => { done() }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/away')
  })

  it('/away <message>', function (done) {
    fakeIrcClient.localUser = {
      'isAway': false,
      'setAway': (message) => {
        if (message === 'gone fishing') {
          done()
        } else {
          assert.ok(false)
        }
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/away gone fishing')
  })

  it('/away (when away)', function (done) {
    fakeIrcClient.localUser = {
      'isAway': true,
      'unsetAway': () => { done() }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/away')
  })

  it('/join <channel>', function (done) {
    fakeIrcClient.joinChannel = (channel, key) => {
      if (channel === '#testing') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/join')
    commandHandler.handle('/join ')
    commandHandler.handle('/join #testing')
  })

  it('/join <channel> <key>', function (done) {
    fakeIrcClient.joinChannel = (channel, key) => {
      if (channel === '#testing' && key === 'luggage') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/join #testing luggage')
  })

  it('/nick <nickName>', function (done) {
    fakeIrcClient.setNickName = (nickName) => {
      if (nickName === 'Wizzard') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/nick')
    commandHandler.handle('/nick ')
    commandHandler.handle('/nick Wizzard')
  })

  it('/quit', function (done) {
    fakeIrcClient.quit = (nickName) => {
      done()
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, {})
    commandHandler.handle('/quit')
  })

  it('/quit <reason>', function (done) {
    fakeIrcClient.quit = (reason) => {
      if (reason === 'Bye cruel world') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, {})
    commandHandler.handle('/quit Bye cruel world')
  })

  it('/part', function (done) {
    let fakeChannel = {
      'part': (reason) => {
        done()
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/part')
  })

  it('/part <reason>', function (done) {
    let fakeChannel = {
      'part': (reason) => {
        if (reason === 'Screw you guys, I\'m going home') {
          done()
        } else {
          assert.ok(false)
        }
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/part Screw you guys, I\'m going home')
  })

  it('/mode <channel> <mode>', function (done) {
    fakeIrcClient.localUser = { 'nickName': 'Rincewind' }
    fakeIrcClient.setChannelModes = (channel, mode, params) => {
      if (channel.name === '#testing' && mode === '+m') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, { 'name': '#testing' })
    commandHandler.handle('/mode')
    commandHandler.handle('/mode ')
    commandHandler.handle('/mode #testing')
    commandHandler.handle('/mode #testing +m')
  })

  it('/mode <channel> <mode> <param>', function (done) {
    fakeIrcClient.localUser = { 'nickName': 'Rincewind' }
    fakeIrcClient.setChannelModes = (channel, mode, params) => {
      if (channel.name === '#testing' && mode === '+o' && params[0] === 'Twoflower') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, { 'name': '#testing' })
    commandHandler.handle('/mode #testing +o Twoflower')
  })

  it('/me <message>', function (done) {
    fakeIrcClient.localUser = {}
    fakeCtcpClient.action = (targets, message) => {
      if (targets[0] === '#testing' && message === 'slaps Twoflower around a bit with a large trout') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, { 'name': '#testing' })
    commandHandler.handle('/me')
    commandHandler.handle('/me ')
    commandHandler.handle('/me slaps Twoflower around a bit with a large trout')
  })

  it('/topic <topic>', function (done) {
    let fakeChannel = {
      'setTopic': (newTopic) => {
        if (newTopic === 'Ankh-Morpork on Fire!') {
          done()
        } else {
          assert.ok(false)
        }
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/topic')
    commandHandler.handle('/topic ')
    commandHandler.handle('/topic Ankh-Morpork on Fire!')
  })

  it('/invite <nickName>', function (done) {
    let fakeChannel = {
      'invite': (nickName) => {
        if (nickName === 'Twoflower') {
          done()
        } else {
          assert.ok(false)
        }
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/invite')
    commandHandler.handle('/invite ')
    commandHandler.handle('/invite Twoflower')
  })

  it('/hop', function (done) {
    let fakeChannel = { 'name': '#testing' }
    let partChannelPromise = new Promise((resolve, reject) => {
      fakeChannel.part = () => { resolve() }
    })

    let joinChannelPromise = new Promise((resolve, reject) => {
      fakeIrcClient.joinChannel = (channelName) => {
        if (channelName === '#testing') {
          resolve()
        } else {
          reject(new Error('Called with invalid channelName.'))
        }
      }
    })

    partChannelPromise.then(joinChannelPromise).then(done)

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/hop')
  })

  it('/hop <channel>', function (done) {
    let fakeChannel = { 'name': '#testing' }
    let partChannelPromise = new Promise((resolve, reject) => {
      fakeChannel.part = () => { resolve() }
    })

    let joinChannelPromise = new Promise((resolve, reject) => {
      fakeIrcClient.joinChannel = (channelName) => {
        if (channelName === '#foobar') {
          resolve()
        } else {
          reject(new Error('Called with invalid channelName.'))
        }
      }
    })

    partChannelPromise.then(joinChannelPromise).then(done)

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, fakeChannel)
    commandHandler.handle('/hop #foobar')
  })

  it('/raw', function (done) {
    fakeIrcClient.sendRawMessage = (message) => {
      if (message === 'JOIN :#foobar') {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/raw')
    commandHandler.handle('/raw ')
    commandHandler.handle('/raw JOIN :#foobar')
  })

  it('/server <host>', function (done) {
    fakeIrcClient.disconnect = () => {}
    fakeIrcClient.registrationInfo = {}
    fakeIrcClient.connect = (hostName, port, registrationInfo) => {
      if (hostName === 'irc.quakenet.org' && port === 6667) {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/server')
    commandHandler.handle('/server ')
    commandHandler.handle('/server irc.quakenet.org')
  })

  it('/server <host:port>', function (done) {
    fakeIrcClient.disconnect = () => {}
    fakeIrcClient.registrationInfo = {}
    fakeIrcClient.connect = (hostName, port, registrationInfo) => {
      if (hostName === 'irc.quakenet.org' && port === 6668) {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/server irc.quakenet.org:6668')
  })

  it('/server <ipAddress:port>', function (done) {
    fakeIrcClient.disconnect = () => {}
    fakeIrcClient.registrationInfo = {}
    fakeIrcClient.connect = (hostName, port, registrationInfo) => {
      if (hostName === '127.0.0.1' && port === 6667) {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/server 127.0.0.1:6667')
  })

  it('/server <ipAddress:port>', function (done) {
    fakeIrcClient.disconnect = () => {}
    fakeIrcClient.registrationInfo = {}
    fakeIrcClient.connect = (hostName, port, registrationInfo) => {
      if (hostName === '127.0.0.1' && port === 6668) {
        done()
      } else {
        assert.ok(false)
      }
    }

    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient)
    commandHandler.handle('/server 127.0.0.1:6668')
  })

  it('/clear', function (done) {
    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, {})
    commandHandler.on('clear', done)
    commandHandler.handle('/clear')
  })

  it('/clearall', function (done) {
    let commandHandler = new IrcCommandHandler(fakeIrcClient, fakeCtcpClient, {})
    global.broadcaster.on('clearAll', done)
    commandHandler.handle('/clearall')
  })
})

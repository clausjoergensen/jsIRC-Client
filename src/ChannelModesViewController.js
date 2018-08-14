// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { remote, ipcRenderer } = require('electron')

ipcRenderer.once('message', (event, message) => {
  document.getElementById('topic').value = message.topic || ''
})

function ok () {
  let topicInputElement = document.getElementById('topic')
  ipcRenderer.send('reply', {
    topic: topicInputElement.value
  })
  remote.getCurrentWindow().close()
}

function cancel () {
  remote.getCurrentWindow().close()
}

document.addEventListener('DOMContentLoaded', function (event) {
  document.getElementById('ok').addEventListener('click', () => {
    ok()
  })

  document.getElementById('cancel').addEventListener('click', () => {
    cancel()
  })

  let topicInputElement = document.getElementById('topic')
  topicInputElement.addEventListener('keyup', e => {
    let key = e.which || e.keyCode
    if (key === 13) {
      ok()
    }
    if (key === 27) {
      cancel()
    }
  })

  topicInputElement.focus()
})

// Copyright (c) 2018 Claus Jørgensen
// This code is licensed under MIT license (see LICENSE.txt for details)
'use strict'

const { app, shell, BrowserWindow, Menu, globalShortcut } = require('electron')
const path = require('path')
const __ = require('./src/i18n.js')
const URL = require('url').URL

let mainWindow = null

// Workaround to enable HTML5 notifications for local development.
if (!app.isPackaged) {
  app.setAppUserModelId('com.dev.jsirc')
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    'width': 1024,
    'height': 768,
    'icon': 'app.ico',
    'accept-first-mouse': true,
    'title-bar-style': 'hidden',
    'webPreferences': {
      'devTools': !app.isPackaged
    }
  })

  mainWindow.loadURL(path.join('file://', __dirname, '/src/index.html'))

  mainWindow.once('close', (e) => {
    e.preventDefault()
    mainWindow.webContents.send('close', e)
    setTimeout(() => mainWindow.close(), 100)
  })

  mainWindow.on('closed', (e) => {
    mainWindow = null
  })

  if (!app.isPackaged) {
    globalShortcut.register('CommandOrControl+R', function (e) {
      mainWindow.webContents.send('reload', e)
      setTimeout(() => mainWindow.reload(), 100)
    })
  }

  mainWindow.webContents.on('new-window', function (e, url) {
    if (url.startsWith('https://open.spotify.com/go?uri=')) {
      let spotifyURL = new URL(url)
      shell.openExternal(spotifyURL.searchParams.get('uri'))
      e.preventDefault()
    }
  })

  let aboutWindow = null

  let template = [
    {
      label: __('MENU_FILE'),
      submenu: [
        {
          label: __('MENU_PREFERENCES'),
          click: (e) => {
            mainWindow.webContents.send('view-preferences', e)
          }
        },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggledevtools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: __('MENU_REPORT_ISSUE'),
          click: () => {
            shell.openExternal('https://github.com/clausjoergensen/jsIRC/issues/new/choose')
          }
        },
        { type: 'separator' },
        {
          role: 'about',
          click: () => {
            aboutWindow = new BrowserWindow({
              'width': 400,
              'height': 270,
              'title': 'jsIRC - About',
              'title-bar-style': 'hidden',
              'resizable': false,
              'modal': true,
              'alwaysOnTop': true,
              'parent': mainWindow,
              'webPreferences': {
                'devTools': !app.isPackaged
              }
            })

            aboutWindow.setMenu(null)
            aboutWindow.loadURL(path.join('file://', __dirname, '/src/about.html'))

            aboutWindow.on('closed', (e) => {
              aboutWindow = null
            })
          }
        }
      ]
    }
  ]

  if (app.isPackaged) {
    delete template[2].submenu[6] // reload
    delete template[2].submenu[7] // forcereload
    delete template[2].submenu[8] // toggledevtools
  }

  const mainMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(mainMenu)
})

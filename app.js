// Copyright (c) 2018 Claus Jørgensen
'use strict'

const { app, shell, BrowserWindow, Menu } = require('electron')
const path = require('path')

let mainWindow = null

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
      'devTools': app.isPackaged
    }
  })

  mainWindow.loadURL(path.join('file://', __dirname, '/src/index.html'))

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  let template = [
    {
      label: 'File',
      submenu: [
        { label: 'Options' },
        { type: 'separator' },
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
        { role: 'forcereload' },
        { role: 'toggledevtools' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Report Issue…',
          click: () => {
            shell.openExternal('https://github.com/clausjoergensen/jsIRC/issues/new/choose');
          }
        },
        { type: 'separator' },
        { role: 'about' }
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

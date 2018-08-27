// Imported from https://developer.spotify.com/documentation/web-api/libraries/
'use strict'

module.exports = {
  validateURI: function validateURI(uri) {
    if (uri.match(/^spotify:(?:track|album|artist|show|episode):[a-zA-Z0-9]{22}$/)) {
      return uri;
    } else if (uri.match(/^spotify:user:[^:]+:playlist:[a-zA-Z0-9]{22}$/)) {
      return uri;
    } else if (uri.match(/^https?:\/\/(?:open|play)\.spotify\.com\/(?:track|album|artist|show|episode)\/[a-zA-Z0-9]{22}\/?$/)) {
      return 'spotify:' + uri.replace(/^https?:\/\/(?:open|play)\.spotify\.com\//, '').split('/').join(':');
    } else if (uri.match(/^https?:\/\/(?:open|play)\.spotify\.com\/user\/[^:]+\/playlist\/[a-zA-Z0-9]{22}\/?$/)) {
      return 'spotify:' + uri.replace(/^https?:\/\/(?:open|play)\.spotify\.com\//, '').split('/').join(':');
    }
    return false;
  },

  toHTML: function toHTML(uri) {
    let match = uri.match(/^spotify:(track|album|user|artist|show|episode):[^:]+(?::(playlist):[A-Za-z0-9]+)?/);
    let type = null
    if (match[2] && match[1] === 'user') {
      type = 'playlist';
    } else if (!match[2] && match[1] === 'track') {
      type = 'track';
    } else if (!match[2] && match[1] === 'album') {
      type = 'album';
    } else if (!match[2] && match[1] === 'artist') {
      type = 'artist';
    } else if (!match[2] && match[1] === 'show') {
      type = 'show';
    } else if (!match[2] && match[1] === 'episode') {
      type = 'episode';
    }

    let embedURL = 'https://open.spotify.com/embed/' + uri.replace('spotify:', '').split(':').join('/')
    let code = `<iframe src="${embedURL}" width="350" height="80" frameborder="0" allowtransparency="true" allow="encrypted-media" align="top"></iframe>`
    
    return code
  }
};

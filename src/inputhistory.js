/**
 * Modified version of https://github.com/erming/inputhistory for Node.js
 *
 * @license MIT
 */
module.exports = function (input) {
  let options = {
    history: [],
    preventSubmit: false
  }
  let history = options.history
  history.push('')
  let i = 0
  input.on('keydown', function (e) {
    let key = e.which
    switch (key) {
      case 13: // Enter
        if (input.val() !== '') {
          i = history.length
          history[i - 1] = input.val()
          history.push('')
          if (history[i - 1] === history[i - 2]) {
            history.splice(-2, 1)
            i--
          }
        }
        break
      case 38: // Up
      case 40: // Down
        history[i] = input.val()
        if (key === 38 && i !== 0) {
          i--
        } else if (key === 40 && i < history.length - 1) {
          i++
        }
        input.val(history[i])
        break
      default:
        return
    }
    e.preventDefault()
  })
  return input
}

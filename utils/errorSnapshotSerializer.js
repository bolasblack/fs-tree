const { inspect } = require('util')
const { omit } = require('ramda')

module.exports = {
  print(val, serialize, indent) {
    return `${val.constructor.name}(
  ${serialize(val.message)}
  ${inspect(Object.assign({}, val), {
    depth: null,
  })}
)`
  },

  test(val) {
    return val instanceof Error
  },
}

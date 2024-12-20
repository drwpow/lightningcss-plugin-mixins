import { composeVisitors } from 'lightningcss'
import postcssMixins, { customAtRules as mixinsAtRules } from './postcss-mixins.js'

/**
 * @typedef {import("lightningcss").TransformOptions} TransformOptions
 */

/**
 * Add postcss-mixins and postcss-simple-vars to Lightning CSS
 * @param {TransformOptions} [options]
 * @return {TransformOptions}
 */
export default function fplLightningCss(options) {
  return {
    ...options,

    customAtRules: {
      ...options?.customAtRules,
      ...mixinsAtRules,
    },

    visitor: composeVisitors([postcssMixins]),
  }
}

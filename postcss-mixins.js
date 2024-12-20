import { transform } from 'lightningcss'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const resolvers = new Map()
const importedCss = new Set()
const mixins = new Map()

// ----------------------
//  Main module
// ----------------------

/** @type {import("lightningcss").CustomAtRules */
export const customAtRules = {
  'define-mixin': {
    prelude: '<custom-ident>',
    body: 'style-block',
  },
  mixin: {
    prelude: '<custom-ident>',
    body: 'style-block',
  },
  'mixin-content': {
    prelude: null,
  },
}

/**
 * Lightning CSS version of postcss-mixins.
 * @see https://lightningcss.dev/transforms.html#custom-at-rules
 * @type {import("lightningcss").Visitor}
 */
const visitor = {
  // on stylesheet load, use that to resolve relative @import URLs
  StyleSheet(stylesheet) {
    for (const source of stylesheet.sources) {
      try {
        resolvers.set(source, createRequire(source))
      } catch {
        // noop
      }
    }
  },
  Rule: {
    import(rule) {
      return importMixins(rule.value.url)
    },

    custom(rule) {
      const name = rule.prelude?.value
      if (rule.name === 'define-mixin') {
        mixins.set(name, rule.body.value)
        return []
      }
      if (rule.name === 'mixin') {
        const mixin = getMixin(name)
        return replaceMixinContent(mixin, rule.body.value)
      }
    },

    // special handling: if a mixin is easily “flattenable,” then hoist it
    // up into its parent class
    style(rule) {
      const hasMixin = hasCustomAtRule(rule, 'mixin')
      if (hasMixin) {
        const name = rule.value.rules.find((r) => r.type === 'custom' && r.value.name === 'mixin')
          ?.value.prelude?.value
        const mixin = getMixin(name)
        const isDeclarationOnlyMixin = mixin.every(
          (m) => (!m.value.rules || !m.value.rules.length) && m.value.declarations,
        )
        if (isDeclarationOnlyMixin) {
          return {
            ...rule,
            value: {
              ...rule.value,
              rules: rule.value.rules.filter(
                (r) => !(r.type === 'custom' && r.value.name === 'mixin'),
              ),
              declarations: {
                ...rule.value.declarations,
                declarations: [
                  ...rule.value.declarations.declarations,
                  ...mixin.map((m) => m.value.declarations.declarations).flat(),
                ],
              },
            },
          }
        }
      }
    },
  },
}

export default visitor

// --------------------
//  Helpers
// --------------------

/**
 * Resolve an @import statement
 * @param {string} specifier
 * @param {string}
 */
function resolveImport(specifier) {
  for (const resolver of resolvers.values()) {
    try {
      return resolver.resolve(specifier)
    } catch {
      // noop
    }
  }

  throw new Error(`Could not resolve ${specifier}.`)
}

/**
 * Import @define-mixins from an @import URL
 * @param {string} filename
 * @return {void}
 */
function importMixins(url) {
  const filename = resolveImport(url)

  // don’t parse the same thing twice
  if (importedCss.has(filename)) {
    return []
  }

  // we’re parsing with Lightning CSS, inside Lightning CSS, which isn’t great,
  // but we are caching files. Because we’re using CSS @imports in a module
  // sense, we do need to parse external files to transform the current CSS
  // properly.
  transform({
    filename,
    code: fs.readFileSync(filename),
    customAtRules,
    visitor,
  })

  importedCss.add(filename)

  return []
}

/**
 * @param {string} name
 */
function getMixin(name) {
  const mixin = mixins.get(name)
  if (!mixin) {
    throw new Error(`Undefined mixin: ${name}. Use @define-mixin first to set mixin.`)
  }
  return mixin
}

/**
 * @param {import("lightningcss").Style} style
 * @param {string} name
 * @return {boolean}
 */
function hasCustomAtRule(rule, name) {
  return rule.value.rules.some((r) => r.type === 'custom' && r.value.name === name)
}

/**
 * Take a style body and replace @mixin-content with another node.
 * @param {import("lightningcss").Rule} wrapper
 * @param {import("lightningcss").Rule} rule
 * @return {import("lightningcss").ReturnedRule}
 */
function replaceMixinContent(wrapper, content) {
  return (Array.isArray(wrapper) ? wrapper : [wrapper]).map((rule, i) => {
    if (!rule.value || !Array.isArray(rule.value.rules)) {
      return rule
    }

    // replace @mixin-content with contents
    const hasMixinContent = hasCustomAtRule(rule, 'mixin-content')
    if (hasMixinContent) {
      if (rule.type === 'media') {
        return { ...rule, value: { ...rule.value, rules: content } }
      }

      if (rule.type === 'style') {
        return {
          ...rule,
          value: {
            ...rule.value,
            declarations: content[i].value.declarations,
            rules: rule.value.rules.filter(
              (r) => !(r.type === 'custom' && r.value.name === 'mixin-content'),
            ),
          },
        }
      }

      throw new Error(`Unhandled type: ${rule.type}`)
    }

    // otherwise, recursively scan nested rules
    if (rule.value.rules.length) {
      return {
        ...rule,
        value: { ...rule.value, rules: replaceMixinContent(rule.value.rules, content) },
      }
    }
    return rule
  })
}

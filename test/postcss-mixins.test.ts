import { transform } from 'lightningcss'
import { describe, expect, test } from 'vitest'
import fplLightningCss from '../index.js'

describe('postcss-mixins', () => {
  const tests: [string, { given: string; want: string }][] = [
    [
      'simple',
      {
        given: `.button {
  color: blue;
}`,
        want: `.button {
  color: #00f;
}`,
      },
    ],
    [
      'block with selector',
      {
        given: `@define-mixin selector {
  .my-selector & {
    @mixin-content;
  }
}

.component {
  background: transparent;

  @mixin selector {
    background: #639;
  }
}`,
        want: `.component {
  background: none;
}

.my-selector .component {
  background: #639;
}`,
      },
    ],
    [
      'block with media',
      {
        given: `@define-mixin desktop {
  @media (width >= 600px) {
    @mixin-content;
  }
}

.layout {
  font-size: 1rem;

  @mixin desktop {
    font-size: 1.25rem;
  }
}`,
        want: `.layout {
  font-size: 1rem;
}

@media (min-width: 600px) {
  .layout {
    font-size: 1.25rem;
  }
}`,
      },
    ],
    [
      'block with pseudo',
      {
        given: `@define-mixin focus {
  &:focus-visible {
    @mixin-content
  }
}

.button {
  outline: none;

  @mixin focus {
    outline: 2px solid #0ff;
  }
}`,

        want: `.button {
  outline: none;
}

.button:focus-visible {
  outline: 2px solid #0ff;
}`,
      },
    ],
    [
      'block with vars',
      {
        given: `@define-mixin setVar {
  --foo: #123;
  --bar: #456;
}

.component {
  --baz: 1rem;

  @mixin setVar {}
}`,
        want: `.component {
  --baz: 1rem;
  --foo: #123;
  --bar: #456;
}`,
      },
    ],
    [
      'inline nested',
      {
        given: `@define-mixin bgDisabled {
  background: #d0d0d0;
}

.button {
  background: #fff;

  &:disabled {
    @mixin bgDisabled {}

    &:hover {
      @mixin bgDisabled {}
    }
  }
}`,
        want: `.button {
  background: #fff;
}

.button:disabled {
  background: #d0d0d0;
}

.button:disabled:hover {
  background: #d0d0d0;
}`,
      },
    ],
  ]

  test.each(tests)('%s', (_, { given, want }) => {
    const result = transform(fplLightningCss({ filename: 'test.css', code: Buffer.from(given) }))
    for (const warn of result.warnings) {
      console.warn(warn.message)
    }
    const css = result.code.toString().trim()
    expect(css).toBe(want)
  })
})

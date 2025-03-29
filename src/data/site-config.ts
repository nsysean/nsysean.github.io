export type Image = {
    src: string;
    alt?: string;
    caption?: string;
};

export type Link = {
    text: string;
    href: string;
};

export type Hero = {
    title?: string;
    text?: string;
    image?: Image;
    actions?: Link[];
};

export type Subscribe = {
    title?: string;
    text?: string;
    formUrl: string;
};

export type SiteConfig = {
    logo?: Image;
    title: string;
    subtitle?: string;
    description: string;
    image?: Image;
    headerNavLinks?: Link[];
    footerNavLinks?: Link[];
    socialLinks?: Link[];
    hero?: Hero;
    subscribe?: Subscribe;
    postsPerPage?: number;
    projectsPerPage?: number;
};

const siteConfig: SiteConfig = {
    title: '',
    subtitle: '',
    description: '',
    headerNavLinks: [
        {
            text: 'Home',
            href: '/'
        },
        {
            text: 'Posts',
            href: '/posts'
        },
        {
            text: 'Tags',
            href: '/tags'
        },
    ],
    footerNavLinks: [
        {
            text: 'Contact',
            href: '/contact'
        },
    ],
    socialLinks: [
        {
            text: 'X/Twitter',
            href: 'https://x.com/ensyzip'
        },
        {
            text: 'GitHub',
            href: 'https://github.com/nsysean'
        },
    ],
    hero: {
        title: 'Hey!',
        text: "I'm **Sean**, otherwise known as *ensy* or *nsysean*, a programmer and CTF player from Hong Kong. [Learn more about me.](/about)",
        actions: [
            {
                text: 'Get in Touch',
                href: '/contact'
            }
        ]
    },
    postsPerPage: 8,
    projectsPerPage: 8
};

export default siteConfig;

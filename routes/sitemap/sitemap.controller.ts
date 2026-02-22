import type { Request, Response } from "express";
import { BlogService } from "../../services/blog/Blog.service.ts";
import { writeToLog, logConsole } from "../../middlewares/log.middlewar.ts";

const escapeXml = (unsafe: string): string => {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case "'":
        return "&apos;";
      case '"':
        return "&quot;";
      default:
        return c;
    }
  });
};

class SitemapController {
  /**
   * Generate and return the sitemap.xml
   */
  static async getSitemap(req: Request, res: Response): Promise<void> {
    try {
      const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3000";

      const blogPostsResponse = await BlogService.getAllPosts(1, 1000, false);

      const blogPosts = blogPostsResponse.posts
        .filter((postResult) => postResult.post.indexed === 1)
        .map((postResult) => ({
          slug: postResult.post.slug,
          updatedAt: postResult.post.editedAt || postResult.post.createdAt,
        }));

      const staticPages = [
        { url: "/", changefreq: "monthly", priority: 1.0 },
        { url: "/about", changefreq: "monthly", priority: 0.8 },
        { url: "/projects", changefreq: "weekly", priority: 0.9 },
        { url: "/blog", changefreq: "daily", priority: 0.9 },
      ];

      const staticPageUrls = staticPages
        .map((page) => {
          return (
            `  <url>\n` +
            `    <loc>${BASE_URL}${page.url}</loc>\n` +
            `    <changefreq>${page.changefreq}</changefreq>\n` +
            `    <priority>${page.priority}</priority>\n` +
            `  </url>`
          );
        })
        .join("\n");

      const blogPostUrls = blogPosts
        .map((post) => {
          const date = post.updatedAt
            ? new Date(post.updatedAt).toISOString()
            : new Date().toISOString();
          return (
            `  <url>\n` +
            `    <loc>${BASE_URL}/blog/${escapeXml(post.slug)}</loc>\n` +
            `    <lastmod>${date}</lastmod>\n` +
            `    <changefreq>weekly</changefreq>\n` +
            `    <priority>0.7</priority>\n` +
            `  </url>`
          );
        })
        .join("\n");

      const sitemap =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        staticPageUrls +
        "\n" +
        blogPostUrls +
        "\n" +
        `</urlset>`;

      res.header("Content-Type", "application/xml");
      res.header("Cache-Control", "public, max-age=21600");
      res.status(200).send(sitemap);

      writeToLog(
        `Sitemap generated: ${staticPages.length} static + ${blogPosts.length} dynamic URLs`,
        "seo",
      );
      logConsole(
        "GET",
        "/sitemap.xml",
        "OK",
        "Sitemap generated: {static} static + {dynamic} dynamic URLs",
        {
          static: staticPages.length,
          dynamic: blogPosts.length,
        },
      );
    } catch (error) {
      writeToLog(`Sitemap Error: ${error}`, "seo_error");
      logConsole("GET", "/sitemap.xml", "FAIL", `Sitemap Error: ${error}`, {});
      console.error("❌ Sitemap Error:", error);
      res.status(500).send("Error generating sitemap");
    }
  }

  /**
   * Generate and return the robots.txt
   */
  static getRobots(req: Request, res: Response): void {
    const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3000";

    const robots =
      `User-agent: *\n` +
      `Allow: /\n` +
      `Disallow: /admin/\n` +
      `Disallow: /api/\n` +
      `Disallow: /private/\n` +
      `\n` +
      `Sitemap: ${BASE_URL}/sitemap.xml`;

    res.header("Content-Type", "text/plain");
    res.header("Cache-Control", "public, max-age=86400");
    res.status(200).send(robots);

    writeToLog("Robots.txt requested", "seo");
    logConsole("GET", "/robots.txt", "OK", "Robots.txt delivered", {
      url: BASE_URL,
    });
  }
  /**
   * Generate and return the ai.txt
   */
  static getAiPolicy(req: Request, res: Response): void {
    const aiTxt =
    `# AI Usage & Crawling Policy\n` +
    `# This file defines how AI systems may interact with this website.\n` +
    `\n` +
    `User-agent: GPTBot\n` +
    `User-agent: ChatGPT-User\n` +
    `User-agent: CCBot\n` +
    `User-agent: anthropic-ai\n` +
    `User-agent: Claude-Web\n` +
    `User-agent: Googlebot-Extended\n` +
    `User-agent: Bingbot\n` +
    `User-agent: Bytespider\n` +
    `User-agent: FacebookBot\n` +
    `\n` +
    `# Allowed: discovery and referencing only\n` +
    `Allow: /robots.txt\n` +
    `Allow: /ai.txt\n` +
    `Allow: /sitemap.xml\n` +
    `Allow: /blog\n` +
    `\n` +
    `# Blog articles policy\n` +
    `# AI systems may discover and index article URLs\n` +
    `# but MUST NOT extract, summarize, paraphrase,\n` +
    `# reproduce, or serve article content.\n` +
    `# Training on this content is explicitly forbidden.\n` +
    `Disallow: /blog/\n` +
    `\n` +
    `# Disallow all other content consumption\n` +
    `Disallow: /\n` +
    `\n` +
    `# Respect server resources\n` +
    `Crawl-delay: 10`;
  

    res.header("Content-Type", "text/plain");
    res.status(200).send(aiTxt);

    writeToLog("AI policy (ai.txt) requested", "seo");
    logConsole(
      "GET",
      "/ai.txt",
      "OK",
      "AI policy delivered with crawl restrictions",
    );
  }

  /**
   * Generate and return the manifest.json (PWA)
   */
  static getManifest(req: Request, res: Response): void {
    const BASE_URL = process.env.FRONTEND_URL || "http://localhost:3000";
    
    const manifest = {
      name: "Jonathan Gleyze - Full Stack Developer",
      short_name: "Jonathan Gleyze",
      description: "Portfolio de développeur Full Stack présentant des projets de développement web, des articles de blog et une expertise technique en Node.js, React, TypeScript et technologies web modernes.",
      start_url: "/",
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#121212",
      theme_color: "#121212",
      categories: ["productivity", "technology"],
      screenshots: [
        {
          src: "/favicon/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          form_factor: "narrow"
        },
        {
          src: "/favicon/web-app-manifest-512x512.png",
          sizes: "512x512",
          type: "image/png",
          form_factor: "wide"
        }
      ],
      icons: [
        {
          src: "/favicon/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any"
        },
        {
          src: "/favicon/web-app-manifest-512x512.png",
          sizes: "512x512",
          type: "image/png",
          purpose: "any"
        },
      ],
      shortcuts: [
        {
          name: "Voir le blog",
          short_name: "Blog",
          description: "Lire mes articles de blog ",
          url: "/blog",
          icons: [
            {
              src: "/favicon/web-app-manifest-192x192.png",
              sizes: "192x192"
            }
          ]
        },
        {
          name: "Voir les projets",
          short_name: "Projets",
          description: "Explorer mes projets de portfolio",
          url: "/#project",
          icons: [
            {
              src: "/favicon/web-app-manifest-192x192.png",
              sizes: "192x192"
            }
          ]
        }
      ],
      share_target: {
        action: "/share",
        method: "POST",
        enctype: "application/x-www-form-urlencoded",
        params: {
          title: "title",
          text: "text",
          url: "url"
        }
      }
    };

    res.header("Content-Type", "application/manifest+json");
    res.header("Cache-Control", "public, max-age=86400");
    res.status(200).json(manifest);

    writeToLog("Manifest.json (PWA) requested", "pwa");
    logConsole(
      "GET",
      "/manifest.json",
      "OK",
      "PWA manifest delivered with icons and shortcuts",
    );
  }
}

export default SitemapController;

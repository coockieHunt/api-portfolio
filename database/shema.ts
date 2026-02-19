import { relations } from 'drizzle-orm';
import { sqliteTable, text, integer, primaryKey, numeric } from 'drizzle-orm/sqlite-core';
import { title } from 'node:process';

export const post_author = sqliteTable('post_author', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').unique().notNull(),
    describ: text('describ').notNull(),
});

export const posts = sqliteTable('posts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    featuredImage: text('featured_image'), 
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    content: text('content').notNull(),
    summary: text('summary'),
    published: integer('published').notNull().default(0),
    indexed: integer('indexed').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    editedAt: integer('edited_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
    
    authorId: integer('author_id')
        .references(() => post_author.id), 
});

export const tags = sqliteTable('tags', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    color: text('color').notNull(),
});

export const postTags = sqliteTable('post_tags', {
    postId: integer('post_id')
        .notNull()
        .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
        .notNull()
        .references(() => tags.id, { onDelete: 'cascade' }), 
}, (t) => ({
    pk: primaryKey({ columns: [t.postId, t.tagId] }),
}));

export const postAuthorRelations = relations(post_author, ({ many }) => ({
    posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
    author: one(post_author, {
        fields: [posts.authorId],
        references: [post_author.id],
    }),
    postTags: many(postTags),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
    postTags: many(postTags),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
    post: one(posts, {
        fields: [postTags.postId],
        references: [posts.id],
    }),
    tag: one(tags, {
        fields: [postTags.tagId],
        references: [tags.id],
    }),
}));

export const projects = sqliteTable('projects', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    tabName: text('tab_name').notNull(),
    description: text('description').notNull(),
    content: text('content').notNull(),
    stack: text('stacks').notNull(),
    UrlGithub: text('url_github').notNull(),
    UrlProject: text('url_project'),
    published: integer('published').notNull().default(0),
    gallery: text('gallery').notNull().default('[]'),
});
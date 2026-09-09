import { boolean, index, integer, pgTable, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const cabins = pgTable("cabins", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("idx_cabins_slug").on(table.slug)]);

export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: uuid("user_id").notNull(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "editor"] }).notNull().default("editor"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_user_roles_user_cabin").on(table.userId, table.cabinId),
  index("idx_user_roles_cabin_id").on(table.cabinId),
]);

export const animals = pgTable("animals", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  rp: text("rp").notNull(),
  breed: text("breed").notNull().default("Aberdeen Angus"),
  birthDate: text("birth_date"),
  coat: text("coat"),
  registration: text("registration"),
  description: text("description"),
  geneticsProviderName: text("genetics_provider_name"),
  geneticsProviderUrl: text("genetics_provider_url"),
  catalogSection: text("catalog_section", { enum: ["genetics", "criollos"] }).notNull().default("genetics"),
  introTitle: text("intro_title").notNull().default("Potencia, estructura"),
  introEmphasis: text("intro_emphasis").notNull().default("y corrección."),
  introSecondary: text("intro_secondary").notNull().default("Su pedigree reúne líneas probadas de nuestro programa genético con referentes internacionales de la raza."),
  pedigreeTitle: text("pedigree_title").notNull().default("Pedigree de"),
  pedigreeEmphasis: text("pedigree_emphasis").notNull().default("tres generaciones."),
  pedigreeDescription: text("pedigree_description").notNull().default("Una genealogía sólida, construida sobre padres y madres que marcaron nuestro rodeo."),
  status: text("status", { enum: ["published", "draft"] }).notNull().default("draft"),
  featured: boolean("featured").notNull().default(false),
  sold: boolean("sold").notNull().default(false),
  image: text("image").notNull().default("/animal-black.jpg"),
  birthWeight: text("birth_weight"),
  weaningWeight: text("weaning_weight"),
  scrotalCircumference: text("scrotal_circumference"),
  frame: text("frame"),
  rpLabel: text("rp_label"),
  birthDateLabel: text("birth_date_label"),
  coatLabel: text("coat_label"),
  registrationLabel: text("registration_label"),
  birthWeightLabel: text("birth_weight_label"),
  weaningWeightLabel: text("weaning_weight_label"),
  scrotalCircumferenceLabel: text("scrotal_circumference_label"),
  frameLabel: text("frame_label"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_animals_cabin_rp").on(table.cabinId, table.rp),
  index("idx_animals_cabin_status").on(table.cabinId, table.status),
  index("idx_animals_updated_at").on(table.updatedAt),
]);

export const pedigreeMembers = pgTable("pedigree_members", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull().references(() => animals.id, { onDelete: "cascade" }),
  relation: text("relation").notNull(),
  name: text("name").notNull(),
  registration: text("registration"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [
  uniqueIndex("idx_pedigree_animal_relation").on(table.animalId, table.relation),
  index("idx_pedigree_animal_sort").on(table.animalId, table.sortOrder),
]);

export const geneticData = pgTable("genetic_data", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull().references(() => animals.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  value: text("value").notNull(),
  precision: text("precision"),
  percentile: text("percentile"),
  sortOrder: integer("sort_order").notNull().default(0),
}, (table) => [index("idx_genetic_data_animal_sort").on(table.animalId, table.sortOrder)]);

export const animalMedia = pgTable("animal_media", {
  id: serial("id").primaryKey(),
  animalId: integer("animal_id").notNull().references(() => animals.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["image", "video"] }).notNull(),
  storageKey: text("storage_key"),
  externalUrl: text("external_url"),
  filename: text("filename"),
  contentType: text("content_type"),
  caption: text("caption"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("idx_animal_media_animal_sort").on(table.animalId, table.sortOrder)]);

export const auctions = pgTable("auctions", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  auctionDate: text("auction_date"),
  auctionTime: text("auction_time"),
  auctioneer: text("auctioneer"),
  location: text("location"),
  lots: text("lots"),
  description: text("description"),
  catalogUrl: text("catalog_url"),
  streamUrl: text("stream_url"),
  image: text("image").notNull().default("/ranch.jpg"),
  status: text("status", { enum: ["upcoming", "past"] }).notNull().default("upcoming"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("idx_auctions_cabin_status_date").on(table.cabinId, table.status, table.auctionDate)]);

export const contactMessages = pgTable("contact_messages", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("idx_contact_messages_cabin_read_created").on(table.cabinId, table.isRead, table.createdAt)]);

export const siteImages = pgTable("site_images", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  imageKey: text("image_key").notNull(),
  label: text("label").notNull(),
  storageKey: text("storage_key"),
  draftStorageKey: text("draft_storage_key"),
  fallbackUrl: text("fallback_url").notNull(),
  contentType: text("content_type"),
  draftContentType: text("draft_content_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("idx_site_images_cabin_key").on(table.cabinId, table.imageKey)]);

export const siteContent = pgTable("site_content", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  contentKey: text("content_key").notNull(),
  value: text("value").notNull(),
  draftValue: text("draft_value"),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [uniqueIndex("idx_site_content_cabin_key").on(table.cabinId, table.contentKey)]);

export const sitePublications = pgTable("site_publications", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  snapshot: text("snapshot").notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("idx_site_publications_cabin_date").on(table.cabinId, table.publishedAt)]);

export const animalCategories = pgTable("animal_categories", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  catalogSection: text("catalog_section", { enum: ["genetics", "criollos"] }).notNull().default("genetics"),
  kind: text("kind", { enum: ["category", "coat"] }).notNull().default("category"),
}, (table) => [uniqueIndex("idx_animal_categories_scope_slug").on(table.cabinId, table.catalogSection, table.kind, table.slug)]);

export const galleryMedia = pgTable("gallery_media", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  filename: text("filename"),
  contentType: text("content_type"),
  caption: text("caption"),
  category: text("category"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [index("idx_gallery_media_cabin_published_sort").on(table.cabinId, table.published, table.sortOrder)]);

export const galleryCategories = pgTable("gallery_categories", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
}, (table) => [uniqueIndex("idx_gallery_categories_cabin_slug").on(table.cabinId, table.slug)]);

export const newsPosts = pgTable("news_posts", {
  id: serial("id").primaryKey(),
  cabinId: integer("cabin_id").notNull().references(() => cabins.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  content: text("content"),
  videoUrl: text("video_url"),
  category: text("category").notNull().default("Actualidad"),
  image: text("image").notNull().default("/ranch.jpg"),
  storageKey: text("storage_key"),
  articleImage: text("article_image"),
  articleStorageKey: text("article_storage_key"),
  documentStorageKey: text("document_storage_key"),
  documentFilename: text("document_filename"),
  sortOrder: integer("sort_order").notNull().default(0),
  published: boolean("published").notNull().default(false),
  publishedAt: text("published_at"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("idx_news_posts_cabin_slug").on(table.cabinId, table.slug),
  index("idx_news_posts_cabin_sort_order").on(table.cabinId, table.sortOrder),
  index("idx_news_posts_cabin_published_date").on(table.cabinId, table.published, table.publishedAt),
]);

export type Animal = typeof animals.$inferSelect;
export type NewAnimal = typeof animals.$inferInsert;

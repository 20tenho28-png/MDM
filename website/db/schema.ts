import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const requests=sqliteTable('requests',{
 id:text('id').primaryKey(),session:text('session').notNull(),created:integer('created').notNull(),
 name:text('name').notNull(),email:text('email').notNull(),phone:text('phone').notNull(),
 purpose:text('purpose').notNull(),service:text('service').notNull(),location:text('location').notNull(),
 details:text('details').notNull(),language:text('language').notNull(),status:text('status').notNull().default('received')
},t=>[index('requests_created_idx').on(t.created)]);
export const bookings=sqliteTable('bookings',{
 id:text('id').primaryKey(),requestId:text('request_id').notNull().references(()=>requests.id),
 start:integer('start').notNull(),end:integer('end').notNull(),busyUntil:integer('busy_until').notNull(),
 status:text('status').notNull().default('confirmed'),address:text('address').notNull().default('')
},t=>[index('bookings_start_idx').on(t.start)]);
export const limits=sqliteTable('rate_limits',{key:text('key').primaryKey(),count:integer('count').notNull(),expires:integer('expires').notNull()});
export const notifications=sqliteTable('request_notifications',{
 requestId:text('request_id').primaryKey().references(()=>requests.id),
 status:text('status').notNull().default('pending'),attempts:integer('attempts').notNull().default(0),
 lastAttempt:integer('last_attempt').notNull().default(0),acceptedAt:integer('accepted_at'),providerId:text('provider_id')
});

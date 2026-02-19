// @ts-nocheck
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'user_roles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('user_id').unsigned().notNullable()
      table.integer('role_id').unsigned().notNullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.boolean('is_primary').defaultTo(false)
      table.datetime('expires_at').nullable() // For temporal role escalation
      table.timestamps(true)

      // Foreign key constraints
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE')
      table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE')

      // Prevent duplicate user-role assignments
      table.unique(['user_id', 'role_id'])
      table.index(['user_id'])
      table.index(['role_id'])
      table.index(['tenant_id'])
      table.index(['expires_at'])
      table.index(['is_primary'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
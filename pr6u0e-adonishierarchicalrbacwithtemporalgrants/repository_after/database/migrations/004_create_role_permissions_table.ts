// @ts-nocheck
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'role_permissions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('role_id').unsigned().notNullable()
      table.integer('permission_id').unsigned().notNullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.timestamps(true)

      // Foreign key constraints
      table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE')
      table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE')

      // Prevent duplicate role-permission assignments
      table.unique(['role_id', 'permission_id'])
      table.index(['role_id'])
      table.index(['permission_id'])
      table.index(['tenant_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
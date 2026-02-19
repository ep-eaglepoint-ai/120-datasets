// @ts-nocheck
import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'role_hierarchy'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id')
      table.integer('parent_role_id').unsigned().notNullable()
      table.integer('child_role_id').unsigned().notNullable()
      table.integer('tenant_id').unsigned().notNullable()
      table.timestamps(true)

      // Foreign key constraints
      table.foreign('parent_role_id').references('id').inTable('roles').onDelete('CASCADE')
      table.foreign('child_role_id').references('id').inTable('roles').onDelete('CASCADE')

      // Prevent circular references and duplicate relationships
      table.unique(['parent_role_id', 'child_role_id'])
      table.index(['parent_role_id'])
      table.index(['child_role_id'])
      table.index(['tenant_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}